import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { AgentActivity, Branch, ClarificationState, DecisionNode, EngineEvent, FileGraphSnapshot, HarnessRecord, KnowledgeFact, Mission, MissionStep, MissionSummary, PendingNode, SkillRole, SkillsSnapshot, WorktreeSnapshot } from "@autopilot/shared";
import { AgentRunner, type HarnessContext } from "./agent-runner.js";
import { AutopilotMcpServer } from "./autopilot-mcp.js";
import { BlastRadiusClassifier } from "./blast-radius.js";
import { DecisionGate, MockAuditor, type Auditor } from "./decision-gate.js";
import type { DecisionStore } from "./decision-store.js";
import { deriveFileOverlapEdges, type DecisionArtifact } from "./edge-deriver.js";
import type { KnowledgeStore } from "./knowledge-store.js";
import type { ProfileStore } from "./profile-store.js";
import type { AutopilotPaths } from "./paths.js";
import { SkillsStore } from "./skills-store.js";
import { WorktreeManager } from "./worktree-manager.js";

type EventHandler = (event: EngineEvent, extras?: { activity?: AgentActivity; pending?: PendingNode; clearPending?: string }) => void;

export class LoopEngine {
  readonly mcp: AutopilotMcpServer;
  readonly gate: DecisionGate;
  readonly runner: AgentRunner;
  readonly worktrees: WorktreeManager;
  readonly skills: SkillsStore;

  private activities: AgentActivity[] = [];
  private pendingNodes: PendingNode[] = [];
  private harnessRecords: HarnessRecord[] = [];

  constructor(
    private readonly store: DecisionStore,
    private readonly paths: AutopilotPaths,
    private readonly profile: ProfileStore,
    private readonly knowledge: KnowledgeStore,
    classifier: BlastRadiusClassifier,
    runner = new AgentRunner(),
    auditor: Auditor = new MockAuditor(),
    private onEvent: EventHandler = () => undefined
  ) {
    this.runner = runner;
    this.mcp = new AutopilotMcpServer(store, this.profile, this.knowledge, { memoryRoot: paths.memory, handoffRoot: paths.missions });
    this.gate = new DecisionGate(classifier, this.profile, this.knowledge, store, auditor);
    this.worktrees = new WorktreeManager(resolveMissionSource(paths.root), paths.worktrees);
    this.skills = new SkillsStore(paths.skills);
    this.skills.ensureDefaults();
  }

  setEventHandler(handler: EventHandler): void {
    this.onEvent = handler;
  }

  getActivities(): AgentActivity[] {
    return [...this.activities];
  }

  getPendingNodes(): PendingNode[] {
    return [...this.pendingNodes];
  }

  getHarnessRecords(missionId?: string): HarnessRecord[] {
    if (missionId) {
      const cached = this.store.cacheGet<HarnessRecord[]>(harnessKey(missionId)) ?? [];
      this.harnessRecords = cached;
      return cached;
    }
    return [...this.harnessRecords];
  }

  getClarification(missionId: string): ClarificationState | undefined {
    return this.store.cacheGet<ClarificationState>(clarificationKey(missionId));
  }

  getSkills(): SkillsSnapshot {
    return this.skills.readAll();
  }

  updateSkill(role: SkillRole, body: string): SkillsSnapshot {
    this.skills.write(role, body);
    return this.skills.readAll();
  }

  getFileGraph(missionId: string, branchId?: string): FileGraphSnapshot {
    const snapshot = this.getWorktreeSnapshot(missionId, branchId);
    const changedByDecision = this.buildChangedByDecisionMap(missionId);
    const graph = this.worktrees.buildFileGraph(snapshot.root, changedByDecision);
    return { ...graph, missionId, branchId };
  }

  getPlan(missionId: string): { missionId: string; steps: MissionStep[] } | undefined {
    const cursor = this.store.cacheGet<MissionCursor>(cursorKey(missionId));
    if (!cursor) return undefined;
    return { missionId, steps: cursor.steps };
  }

  listBranches(missionId?: string): Branch[] {
    return this.store.listBranches(missionId);
  }

  listMissionSummaries(): MissionSummary[] {
    const decisions = this.store.listMainDecisions();
    const seen = new Set<string>();
    const summaries: MissionSummary[] = [];
    for (const mission of [...this.store.listMissions()].reverse()) {
      const key = mission.idea.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const scratchPath = this.worktrees.scratchPathFor(mission.id);
      summaries.push({
        ...mission,
        decisionCount: decisions.filter((decision) => decision.missionId === mission.id).length,
        scratchExists: Boolean(scratchPath),
        scratchPath
      });
    }
    return summaries;
  }

  clearAllMissions(): void {
    this.resetRuntimeState();
    this.store.clearAllMissions();
  }

  getWorktreeSnapshot(missionId: string, branchId?: string): WorktreeSnapshot {
    const mission = this.store.getMission(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    if (branchId) {
      const branch = this.store.listBranches(missionId).find((item) => item.id === branchId);
      if (!branch?.worktree) throw new Error(`Branch worktree not found: ${branchId}`);
      return this.worktrees.buildSnapshot({
        missionId,
        root: branch.worktree,
        branchId: branch.id,
        branchLabel: branch.newChoice
      });
    }

    const scratchPath = this.worktrees.scratchPathFor(missionId);
    if (!scratchPath) throw new Error(`Scratch worktree not found for mission: ${missionId}`);
    return this.worktrees.buildSnapshot({ missionId, root: scratchPath });
  }

  readWorktreeFile(missionId: string, relativePath: string, branchId?: string): { path: string; content: string; language: string } {
    const snapshot = this.getWorktreeSnapshot(missionId, branchId);
    return this.worktrees.readWorktreeFile(snapshot.root, relativePath);
  }

  generateOnboardingQuestions(idea: string): { source: "fallback"; questions: string[]; trainingWheels: ReturnType<ProfileStore["trainingWheels"]> } {
    const topic = /auth/i.test(idea) ? "authentication" : "this project";
    return {
      source: "fallback",
      questions: [
        `What should the Pilot optimize for when implementing ${topic}?`,
        "Which architectural choices are non-negotiable in this repo?",
        "When should the Pilot prefer a small local solution over a new dependency?",
        "Which kinds of decisions should always escalate to you?"
      ],
      trainingWheels: this.profile.trainingWheels()
    };
  }

  submitOnboardingAnswers(answers: string[]): { rules: ReturnType<ProfileStore["effectiveRules"]>; trainingWheels: ReturnType<ProfileStore["trainingWheels"]> } {
    this.profile.seedFromOnboarding(answers.filter((answer) => answer.trim().length > 0));
    return { rules: this.profile.effectiveRules(), trainingWheels: this.profile.trainingWheels() };
  }

  profileRules(): ReturnType<ProfileStore["effectiveRules"]> {
    return this.profile.effectiveRules();
  }

  knowledgeFacts(): KnowledgeFact[] {
    return this.knowledge.list();
  }

  revalidateKnowledge(factId: string): ReturnType<KnowledgeStore["revalidate"]> {
    const fact = this.knowledge.list().find((item) => item.id === factId);
    if (!fact) throw new Error(`Knowledge fact not found: ${factId}`);
    return this.knowledge.revalidate(fact);
  }

  async startMission(
    idea: string,
    options: { live?: boolean; autoAnswer?: boolean; background?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode; clarification?: ClarificationState }> {
    this.resetRuntimeState();
    const mission = this.store.createMission(idea);
    const scratchRoot = this.worktrees.createScratchRepo(mission.id);
    this.knowledge.setRepoRoot(scratchRoot);
    this.emitLatest();
    this.store.updateMissionStatus(mission.id, "running");

    const live = Boolean(options.live);
    this.store.cacheSet(cursorKey(mission.id), {
      idea,
      scopedIdea: idea,
      steps: [],
      index: 0,
      live,
      scratchRoot
    });

    const scope = await this.runScope(mission.id, idea, scratchRoot, live);
    if (scope.status === "waiting") {
      return { mission: this.store.getMission(mission.id)!, decisions: [], clarification: scope.clarification };
    }

    return this.continueAfterScope(mission.id, options);
  }

  async answerClarification(
    missionId: string,
    answer: string,
    options: { autoAnswer?: boolean; background?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode; clarification?: ClarificationState }> {
    const clarification = this.getClarification(missionId);
    if (!clarification) throw new Error("Mission is not waiting for clarification");
    clarification.answers.push(answer.trim());
    clarification.currentIndex += 1;
    this.store.cacheSet(clarificationKey(missionId), clarification);
    this.store.addEvent("clarification.answered", missionId, { answer, index: clarification.currentIndex - 1 });
    this.emitLatest();

    if (clarification.currentIndex < clarification.questions.length) {
      this.store.updateMissionStatus(missionId, "waiting");
      this.emitLatest();
      return { mission: this.store.getMission(missionId)!, decisions: [], clarification };
    }

    const cursor = this.mustCursor(missionId);
    const scopedIdea = [cursor.idea, ...clarification.answers.map((item, index) => `Q: ${clarification.questions[index]}\nA: ${item}`)].join("\n");
    cursor.scopedIdea = scopedIdea;
    this.store.cacheSet(cursorKey(missionId), cursor);
    this.store.cacheDelete(clarificationKey(missionId));
    this.store.updateMissionStatus(missionId, "running");
    this.emitLatest();
    return this.continueAfterScope(missionId, options);
  }

  private async continueAfterScope(
    missionId: string,
    options: { autoAnswer?: boolean; background?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode; clarification?: ClarificationState }> {
    const cursor = this.mustCursor(missionId);
    const scopedIdea = cursor.scopedIdea ?? cursor.idea;
    const plan = await this.planMission(missionId, scopedIdea, cursor.scratchRoot, cursor.live);
    cursor.steps = plan.steps;
    cursor.index = 0;
    this.store.cacheSet(cursorKey(missionId), cursor);
    this.emit(this.store.addEvent("mission.planned", missionId, { missionId, steps: plan.steps }));

    if (options.background) {
      void this.runUntilPauseOrDone(missionId, { autoAnswer: Boolean(options.autoAnswer) }).catch((error) => {
        this.store.updateMissionStatus(missionId, "failed");
        this.pushActivity({
          kind: "status",
          message: error instanceof Error ? error.message : String(error),
          missionId
        });
      });
      return { mission: this.store.getMission(missionId)!, decisions: [] };
    }
    return this.runUntilPauseOrDone(missionId, { autoAnswer: Boolean(options.autoAnswer) });
  }

  resetRuntimeState(): void {
    this.activities = [];
    this.pendingNodes = [];
    this.harnessRecords = [];
  }

  async runUntilPauseOrDone(
    missionId: string,
    options: { autoAnswer?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode }> {
    const cursor = this.mustCursor(missionId);
    const decisions = this.store.listMainDecisions(missionId);
    while (cursor.index < cursor.steps.length) {
      const step = cursor.steps[cursor.index];
      const pendingId = `pending_${nanoid(8)}`;
      const pending: PendingNode = {
        id: pendingId,
        missionId,
        stepId: step.id,
        stepName: step.name,
        label: step.description
      };
      this.pendingNodes = [...this.pendingNodes.filter((node) => node.missionId !== missionId), pending];
      this.emit(this.store.addEvent("node.pending", missionId, pending), { pending });
      this.emit(this.store.addEvent("step.started", missionId, { missionId, step }), { pending });

      this.materializeMemory(missionId, step.name, decisions);
      const scopedIdea = cursor.scopedIdea ?? cursor.idea;
      const result = await this.runner.run({
        prompt: this.promptForStep(scopedIdea, step, decisions),
        cwd: cursor.scratchRoot,
        role: "maker",
        missionId,
        stepName: step.name,
        stepId: step.id,
        live: cursor.live,
        harness: this.harnessContext(missionId, "maker", step.id, step.name),
        onActivity: (activity) => this.pushActivity(activity)
      });
      this.clearPending(pendingId);

      if (result.status === "error" || !result.proposedDecision) {
        this.store.updateMissionStatus(missionId, "failed");
        throw new Error(result.text || "Agent run failed to propose a decision");
      }
      const previous = decisions.at(-1);
      if (previous && result.proposedDecision.dependsOn.length === 0) {
        result.proposedDecision.dependsOn = [previous.id];
      }
      result.proposedDecision.stepId = step.id;
      const changedFiles = this.worktrees.changedFilesSinceHead(cursor.scratchRoot);
      this.verifyStep(cursor.scratchRoot);
      result.proposedDecision.citedSurfaces = [...result.proposedDecision.citedSurfaces, ...surfacesFromChangedFiles(changedFiles)];
      const decision = this.mcp.proposeDecision(result.proposedDecision);
      this.store.cacheSet(decisionStepKey(decision.id), { stepId: step.id, stepName: step.name, index: cursor.index });
      this.addDerivedEdges(decision, changedFiles);
      this.store.cacheSet(changedFilesKey(decision.id), changedFiles);
      this.emitLatest();
      const gate = await this.gate.evaluate(decision);
      this.emitLatest();
      if (gate.verdict === "escalate") {
        this.store.updateMissionStatus(missionId, "waiting");
        this.store.cacheSet(cursorKey(missionId), { ...cursor, pendingDecisionId: decision.id });
        this.emitLatest();
        if (!options.autoAnswer) {
          return { mission: this.store.getMission(missionId)!, decisions: this.store.listMainDecisions(missionId), waiting: decision };
        }
        await this.answerEscalation(decision.id, { mode: "approve" }, { autoResume: false });
        return this.runUntilPauseOrDone(missionId, { autoAnswer: true });
      }
      this.captureChangedFileKnowledge(decision, changedFiles);
      this.completeStep(decision, step.name, cursor.scratchRoot);
      decisions.push(decision);
      cursor.index += 1;
      cursor.pendingDecisionId = undefined;
      this.store.cacheSet(cursorKey(missionId), cursor);
      this.emitLatest();
      await delay(Number(process.env.AUTOPILOT_STEP_DELAY_MS ?? 450));
    }
    this.store.updateMissionStatus(missionId, "completed");
    this.emit(this.store.addEvent("mission.completed", missionId, { missionId, decisions: decisions.map((decision) => decision.id) }));
    return { mission: this.store.getMission(missionId)!, decisions: this.store.listMainDecisions(missionId) };
  }

  async answerEscalation(
    decisionId: string,
    answer: { mode: "approve" | "override"; choice?: string; scope?: "once" | "context" | "global" },
    options: { autoResume?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode }> {
    const decision = this.mustDecision(decisionId);
    const cursor = this.mustCursor(decision.missionId);
    if (cursor.pendingDecisionId !== decision.id) throw new Error(`Decision ${decisionId} is not waiting for an answer`);
    if (answer.mode === "override" && answer.choice) {
      decision.choice = answer.choice;
      decision.rationale = `${decision.rationale}\n\nHuman override: ${answer.choice}`;
      const scope = answer.scope ?? "once";
      const delta = this.profile.proposeDelta(`For "${decision.question}", prefer ${answer.choice}.`, scope);
      this.store.addEvent("profile.delta.proposed", decision.missionId, { decisionId, scope, delta });
    }
    this.store.addEvent("gate.decided", decision.missionId, { decisionId, answer });
    this.captureChangedFileKnowledge(decision, this.store.cacheGet<string[]>(changedFilesKey(decision.id)) ?? []);
    const stepMeta = this.store.cacheGet<{ stepName: string }>(decisionStepKey(decision.id));
    this.completeStep(decision, stepMeta?.stepName ?? "step", cursor.scratchRoot);
    cursor.index += 1;
    cursor.pendingDecisionId = undefined;
    this.store.cacheSet(cursorKey(decision.missionId), cursor);
    this.store.updateMissionStatus(decision.missionId, "running");
    this.emitLatest();
    if (options.autoResume === false) {
      return { mission: this.store.getMission(decision.missionId)!, decisions: this.store.listMainDecisions(decision.missionId) };
    }
    return this.runUntilPauseOrDone(decision.missionId);
  }

  async pivot(
    decisionId: string,
    newChoice: string
  ): Promise<{ branch: Branch; invalidated: string[]; reused: string[]; compare: { original: DecisionNode; branch: DecisionNode[]; changed: string[] } }> {
    const decision = this.store.getDecision(decisionId);
    if (!decision?.commitSha) throw new Error(`Decision ${decisionId} has no checkpoint`);
    if (decision.branchId) throw new Error("Cannot pivot a branch decision");

    const invalidated = this.store.invalidationSet(decisionId);
    const reused = this.store.reusedSet(decisionId, decision.missionId);
    const cursor = this.mustCursor(decision.missionId);
    const branchId = `br_${nanoid(10)}`;
    const worktree = this.worktrees.fork(`${decisionId}-${newChoice}`, decision.commitSha, cursor.scratchRoot);

    for (const reusedId of reused) {
      const reusedDecision = this.store.getDecision(reusedId);
      if (reusedDecision?.commitSha && !this.worktrees.hasCommit(reusedDecision.commitSha, worktree)) {
        this.worktrees.replayCommit(reusedDecision.commitSha, worktree);
      }
    }

    const branch: Branch = {
      id: branchId,
      missionId: decision.missionId,
      fromDecisionId: decisionId,
      newChoice,
      worktree,
      status: "running",
      decisions: [],
      invalidated,
      reused,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.saveBranch(branch);
    this.emit(this.store.addEvent("branch.started", decision.missionId, { branchId, decisionId, newChoice, invalidated, reused }));

    const branchDecisions = await this.rerunBranchInvalidated(branch, decision, invalidated, newChoice, cursor, worktree);
    const diffStat = [this.worktrees.workingDiffStat(worktree), `Changed files: ${this.worktrees.changedFilesSinceHead(worktree).join(", ")}`].join("\n");
    const completedBranch = this.store.saveBranch({
      ...branch,
      status: "completed",
      decisions: branchDecisions,
      diffStat
    });
    const compare = this.comparePayload(decision, branchDecisions, invalidated, reused, diffStat);
    this.emit(this.store.addEvent("branch.completed", decision.missionId, { branchId, compare }));
    this.emit(this.store.addEvent("pivot.completed", decision.missionId, { decisionId, newChoice, branchId, worktree, invalidated, reused, compare }));
    return { branch: completedBranch, invalidated, reused, compare };
  }

  saveLesson(decisionId: string, body?: string): string {
    const decision = this.store.getDecision(decisionId);
    if (!decision) throw new Error(`Decision not found: ${decisionId}`);
    mkdirSync(this.paths.lessons, { recursive: true });
    const path = join(this.paths.lessons, `${decision.id}.md`);
    writeFileSync(
      path,
      body ??
        [
          `# Lesson: ${decision.question}`,
          "",
          `Choice: ${decision.choice}`,
          "",
          "## Why this fit",
          decision.rationale,
          "",
          "## Evidence",
          ...decision.citedEvidence.map((item) => `- ${item}`),
          ""
        ].join("\n")
    );
    this.store.markReviewed(decision.id, true);
    this.store.addEvent("debt.updated", decision.missionId, { decisionId: decision.id, lesson: path });
    return path;
  }

  private async runScope(
    missionId: string,
    idea: string,
    scratchRoot: string,
    live: boolean
  ): Promise<{ status: "ready" } | { status: "waiting"; clarification: ClarificationState }> {
    const result = await this.runner.run({
      prompt: this.scopePrompt(idea),
      cwd: scratchRoot,
      role: "scoper",
      missionId,
      stepName: "scope-check",
      stepId: "scope",
      live,
      harness: this.harnessContext(missionId, "scoper", "scope", "scope-check"),
      onActivity: (activity) => this.pushActivity(activity)
    });
    if (result.status === "error" || !result.scopeResult) {
      throw new Error(result.text || "Scope check failed");
    }
    if (result.scopeResult.ready) return { status: "ready" };
    const clarification: ClarificationState = {
      missionId,
      questions: result.scopeResult.questions,
      answers: [],
      currentIndex: 0
    };
    this.store.cacheSet(clarificationKey(missionId), clarification);
    this.store.updateMissionStatus(missionId, "waiting");
    this.emit(this.store.addEvent("clarification.requested", missionId, clarification));
    this.emitLatest();
    return { status: "waiting", clarification };
  }

  private async planMission(missionId: string, idea: string, scratchRoot: string, live: boolean): Promise<{ steps: MissionStep[] }> {
    const result = await this.runner.run({
      prompt: this.planPrompt(idea),
      cwd: scratchRoot,
      role: "planner",
      missionId,
      stepName: idea.slice(0, 40),
      stepId: "plan",
      live,
      harness: this.harnessContext(missionId, "planner", "plan", "plan-mission"),
      onActivity: (activity) => this.pushActivity(activity)
    });
    if (result.status === "error" || !result.plannedSteps?.length) {
      throw new Error(result.text || "Planning failed to produce steps");
    }
    return { steps: result.plannedSteps };
  }

  private scopePrompt(idea: string): string {
    return [
      "You are the Autopilot scoper. Decide if this mission idea is specific enough to plan.",
      `Mission idea: ${idea}`,
      "Return exactly one JSON block.",
      'If ready to plan: {"ready":true}',
      'If underspecified: {"ready":false,"questions":["one clarifying question","optional second"]}',
      "Ask at most 3 questions. Only ask about missing facts — not things already in the prompt."
    ].join("\n");
  }

  private planPrompt(idea: string): string {
    return [
      "You are the Autopilot Pilot planning a bounded mission.",
      `Mission idea: ${idea}`,
      "Return exactly one JSON block with 3-6 ordered steps.",
      "Each step must be consequential enough to end with one proposed decision.",
      "Steps must match the user's actual request.",
      'Schema: {"steps":[{"id":"step-1","name":"kebab-name","description":"what this step decides"}]}'
    ].join("\n");
  }

  private promptForStep(
    idea: string,
    step: MissionStep,
    decisions: DecisionNode[],
    options: { branch?: boolean; overrideChoice?: string; originalChoice?: string } = {}
  ): string {
    const lines = [
      "You are the Autopilot Pilot running a bounded stepped loop.",
      `Mission idea: ${idea}`,
      `Current step: ${step.name}`,
      `Step goal: ${step.description}`,
      `Prior decisions: ${decisions.map((decision) => `${decision.id}:${decision.choice}`).join(", ") || "none"}`
    ];
    if (options.branch) {
      lines.push("This is a branch rerun in an isolated worktree.");
      if (options.overrideChoice) lines.push(`Human override for this step: ${options.overrideChoice}`);
      if (options.originalChoice) lines.push(`Original choice was: ${options.originalChoice}`);
    }
    lines.push(
      "End by proposing exactly one consequential decision as a fenced JSON block.",
      "Each option must include id, label, pros (string array), cons (string array).",
      "Set choice to your recommended option id.",
      "Rationale must explain why the recommended option beats the alternatives.",
      'Schema: {"question":"...","options":[{"id":"a","label":"...","pros":["..."],"cons":["..."]}],"choice":"a","rationale":"...","citedEvidence":[],"citedSurfaces":[],"dependsOn":[]}'
    );
    return lines.join("\n");
  }

  private harnessContext(missionId: string, role: SkillRole, stepId: string, stepName: string): HarnessContext {
    return {
      skills: this.skills.read(role),
      profileRules: this.profile.effectiveRules().map((rule) => rule.text),
      tools: this.mcp.toolNames(),
      onRecord: (record) => {
        const full: HarnessRecord = {
          ...record,
          id: `hrn_${nanoid(10)}`,
          createdAt: new Date().toISOString()
        };
        this.harnessRecords = [...this.harnessRecords.filter((item) => item.id !== full.id), full];
        const key = harnessKey(missionId);
        const existing = this.store.cacheGet<HarnessRecord[]>(key) ?? [];
        this.store.cacheSet(key, [...existing, full]);
        this.emit(this.store.addEvent("agent.activity", missionId, { kind: "status", message: `Harness: ${role} ${stepName}` }));
      }
    };
  }

  private buildChangedByDecisionMap(missionId: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const decision of this.store.listMainDecisions(missionId)) {
      for (const file of this.store.cacheGet<string[]>(changedFilesKey(decision.id)) ?? []) {
        map.set(file, decision.id);
      }
    }
    return map;
  }

  private async rerunBranchInvalidated(
    branch: Branch,
    original: DecisionNode,
    invalidated: string[],
    newChoice: string,
    cursor: MissionCursor,
    worktree: string
  ): Promise<DecisionNode[]> {
    const branchDecisions: DecisionNode[] = [];
    for (const nodeId of invalidated) {
      const originalNode = nodeId === original.id ? original : this.store.getDecision(nodeId);
      if (!originalNode) continue;
      const stepMeta = this.store.cacheGet<{ stepId: string; stepName: string; index: number }>(decisionStepKey(originalNode.id));
      const step =
        cursor.steps.find((item) => item.id === stepMeta?.stepId) ??
        cursor.steps.find((item) => item.name === stepMeta?.stepName);
      if (!step) continue;

      const pendingId = `pending_${nanoid(8)}`;
      const pending: PendingNode = {
        id: pendingId,
        missionId: original.missionId,
        stepId: step.id,
        stepName: step.name,
        label: `Branch rerun: ${step.description}`
      };
      this.pendingNodes = [...this.pendingNodes, pending];
      this.emit(this.store.addEvent("node.pending", original.missionId, { ...pending, branchId: branch.id }), { pending });

      const prior = [...this.store.listMainDecisions(original.missionId).filter((node) => !invalidated.includes(node.id)), ...branchDecisions];
      const overrideChoice = nodeId === original.id ? newChoice : undefined;
      const prompt = this.promptForStep(cursor.scopedIdea ?? cursor.idea, step, prior, {
        branch: true,
        overrideChoice,
        originalChoice: originalNode.choice
      });

      const result = await this.runner.run({
        prompt,
        cwd: worktree,
        role: "maker",
        missionId: original.missionId,
        stepName: step.name,
        stepId: step.id,
        live: cursor.live,
        harness: this.harnessContext(original.missionId, "maker", step.id, step.name),
        onActivity: (activity) => this.pushActivity({ ...activity, message: `Branch: ${activity.message}` })
      });
      this.clearPending(pendingId);

      if (result.status === "error" || !result.proposedDecision) {
        this.store.saveBranch({ ...branch, status: "failed", decisions: branchDecisions });
        throw new Error(result.text || "Branch rerun failed");
      }

      if (overrideChoice) result.proposedDecision.choice = overrideChoice;
      result.proposedDecision.branchId = branch.id;
      result.proposedDecision.stepId = step.id;
      result.proposedDecision.missionId = original.missionId;
      result.proposedDecision.dependsOn = prior.map((node) => node.id).slice(-1);

      const changedFiles = this.worktrees.changedFilesSinceHead(worktree);
      this.verifyStep(worktree);
      result.proposedDecision.citedSurfaces = [...result.proposedDecision.citedSurfaces, ...surfacesFromChangedFiles(changedFiles)];
      const decision = this.mcp.proposeDecision(result.proposedDecision);
      this.store.cacheSet(decisionStepKey(decision.id), { stepId: step.id, stepName: step.name, index: stepMeta?.index });
      this.store.cacheSet(changedFilesKey(decision.id), changedFiles);
      this.emit(this.store.addEvent("branch.node.proposed", original.missionId, { branchId: branch.id, decision }));
      branchDecisions.push(decision);
      this.completeStep(decision, step.name, worktree);
      this.store.saveBranch({ ...branch, decisions: branchDecisions });
      this.emitLatest();
    }

    return branchDecisions;
  }

  private writeMissionArtifact(missionId: string, step: string, decision: DecisionNode): void {
    const dir = join(this.paths.missions, missionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${step}.md`),
      [`# ${step}`, "", `Decision: ${decision.question}`, "", `Choice: ${decision.choice}`, "", decision.rationale, ""].join("\n")
    );
  }

  private materializeMemory(missionId: string, step: string, decisions: DecisionNode[]): void {
    const dir = join(this.paths.memory, missionId);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${String(decisions.length + 1).padStart(3, "0")}-${step}.md`);
    writeFileSync(
      path,
      [
        `# Working Memory: ${step}`,
        "",
        "## Prior Decisions",
        "",
        ...decisions.map((decision) => `- ${decision.id}: ${decision.question} → ${decision.choice}`),
        ""
      ].join("\n")
    );
  }

  private completeStep(decision: DecisionNode, step: string, scratchRoot: string): void {
    this.writeMissionArtifact(decision.missionId, step, decision);
    decision.commitSha = this.worktrees.checkpoint(decision.id, scratchRoot);
    decision.status = "implemented";
    this.store.updateDecision(decision);
  }

  private comparePayload(
    original: DecisionNode,
    branchDecisions: DecisionNode[],
    invalidated: string[],
    reused: string[],
    diffStat = ""
  ): { original: DecisionNode; branch: DecisionNode[]; changed: string[] } {
    const originals = invalidated
      .map((id) => this.store.getDecision(id))
      .filter((node): node is DecisionNode => Boolean(node));
    const changedChoices = branchDecisions
      .map((node, index) => {
        const prior = originals[index];
        if (!prior || prior.choice === node.choice) return undefined;
        return `${node.question}: ${prior.choice} → ${node.choice}`;
      })
      .filter(Boolean) as string[];

    return {
      original,
      branch: branchDecisions,
      changed: [
        `Invalidated ${invalidated.length} node(s); reused ${reused.length} node(s).`,
        ...changedChoices,
        ...diffStat.split("\n").filter(Boolean)
      ]
    };
  }

  private pushActivity(activity: AgentActivity): void {
    this.activities = [...this.activities.slice(-49), activity];
    this.emit(this.store.addEvent("agent.activity", activity.missionId, activity), { activity });
  }

  private clearPending(id: string): void {
    this.pendingNodes = this.pendingNodes.filter((node) => node.id !== id);
    this.emit(this.store.addEvent("agent.activity", undefined, { kind: "status", message: "Step complete" }), { clearPending: id });
  }

  private mustDecision(decisionId: string): DecisionNode {
    const decision = this.store.getDecision(decisionId);
    if (!decision) throw new Error(`Decision not found: ${decisionId}`);
    return decision;
  }

  private mustCursor(missionId: string): MissionCursor {
    const cursor = this.store.cacheGet<MissionCursor>(cursorKey(missionId));
    if (!cursor) throw new Error(`Mission cursor not found: ${missionId}`);
    return cursor;
  }

  private emitLatest(): void {
    const latest = this.store.listEvents().at(-1);
    if (latest) this.emit(latest);
  }

  private emit(event: EngineEvent, extras?: { activity?: AgentActivity; pending?: PendingNode; clearPending?: string }): void {
    this.onEvent(event, extras);
  }

  private addDerivedEdges(decision: DecisionNode, files: string[]): void {
    if (files.length === 0) return;
    const key = artifactKey(decision.missionId);
    const artifacts = this.store.cacheGet<DecisionArtifact[]>(key) ?? [];
    const current = { decisionId: decision.id, files };
    for (const edge of deriveFileOverlapEdges([...artifacts, current]).filter((edge) => edge.to === decision.id)) {
      this.store.addEdge(edge);
    }
    this.store.cacheSet(key, [...artifacts, current]);
  }

  private captureChangedFileKnowledge(decision: DecisionNode, files: string[]): void {
    for (const file of files) {
      this.knowledge.propose({
        subject: `changed-file:${file}`,
        claim: `Scratch repo contains changed file ${file}`,
        locator: { kind: "file-symbol", locator: file },
        provenance: {
          missionId: decision.missionId,
          decisionId: decision.id,
          file,
          note: "Captured from git status after a cleared step."
        }
      });
    }
  }

  private verifyStep(cwd: string): void {
    if (!existsSync(join(cwd, "package.json"))) return;
    if (existsSync(join(cwd, "tsconfig.json"))) {
      execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.json", "--noEmit"], { cwd, stdio: "pipe" });
    }
    const testFile = findTestFile(cwd);
    if (!testFile) return;
    execFileSync("pnpm", ["exec", "vitest", "run", testFile], { cwd, stdio: "pipe" });
  }
}

interface MissionCursor {
  idea: string;
  scopedIdea?: string;
  steps: MissionStep[];
  index: number;
  live: boolean;
  scratchRoot: string;
  pendingDecisionId?: string;
}

function cursorKey(missionId: string): string {
  return `mission-cursor:${missionId}`;
}

function clarificationKey(missionId: string): string {
  return `mission-clarification:${missionId}`;
}

function harnessKey(missionId: string): string {
  return `mission-harness:${missionId}`;
}

function artifactKey(missionId: string): string {
  return `decision-artifacts:${missionId}`;
}

function changedFilesKey(decisionId: string): string {
  return `decision-changed-files:${decisionId}`;
}

function decisionStepKey(decisionId: string): string {
  return `decision-step:${decisionId}`;
}

function findTestFile(cwd: string): string | undefined {
  const preferred = join(cwd, "src", "server.test.ts");
  if (existsSync(preferred)) return "src/server.test.ts";
  return walkFiles(join(cwd, "src")).find((file) => file.endsWith(".test.ts"))?.slice(cwd.length + 1);
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else files.push(path);
  }
  return files;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMissionSource(root: string): string {
  const fixture = join(root, "fixtures", "ts-service");
  return existsSync(fixture) ? fixture : root;
}

function surfacesFromChangedFiles(files: string[]): import("@autopilot/shared").Surface[] {
  return files.map((file) => ({
    id: `derived:${file}`,
    kind: surfaceKindForFile(file),
    source: "derived" as const,
    locator: file
  }));
}

function surfaceKindForFile(file: string): import("@autopilot/shared").Surface["kind"] {
  if (/auth|token|session/i.test(file)) return "auth-security";
  if (/server|route|api/i.test(file)) return "public-api";
  if (/schema|migration/i.test(file)) return "schema";
  return "project";
}
