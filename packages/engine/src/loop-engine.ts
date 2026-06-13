import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DecisionNode, EngineEvent, Mission, Surface } from "@autopilot/shared";
import { AgentRunner } from "./agent-runner.js";
import { AutopilotMcpServer } from "./autopilot-mcp.js";
import { BlastRadiusClassifier } from "./blast-radius.js";
import { DecisionGate, MockAuditor } from "./decision-gate.js";
import type { DecisionStore } from "./decision-store.js";
import type { KnowledgeStore } from "./knowledge-store.js";
import type { ProfileStore } from "./profile-store.js";
import type { AutopilotPaths } from "./paths.js";
import { WorktreeManager } from "./worktree-manager.js";

export class LoopEngine {
  readonly mcp: AutopilotMcpServer;
  readonly gate: DecisionGate;
  readonly runner: AgentRunner;
  readonly worktrees: WorktreeManager;

  constructor(
    private readonly store: DecisionStore,
    private readonly paths: AutopilotPaths,
    profile: ProfileStore,
    knowledge: KnowledgeStore,
    classifier: BlastRadiusClassifier,
    runner = new AgentRunner(),
    private onEvent: (event: EngineEvent) => void = () => undefined
  ) {
    this.runner = runner;
    this.mcp = new AutopilotMcpServer(store, profile, knowledge);
    this.gate = new DecisionGate(classifier, profile, knowledge, store, new MockAuditor());
    this.worktrees = new WorktreeManager(paths.root, paths.worktrees);
  }

  setEventHandler(handler: (event: EngineEvent) => void): void {
    this.onEvent = handler;
  }

  async startMission(
    idea: string,
    options: { live?: boolean; autoAnswer?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode }> {
    const mission = this.store.createMission(idea);
    this.emitLatest();
    this.store.updateMissionStatus(mission.id, "running");
    this.store.cacheSet(cursorKey(mission.id), { idea, steps: this.stepsForIdea(idea), index: 0, live: Boolean(options.live) });
    return this.runUntilPauseOrDone(mission.id, { autoAnswer: Boolean(options.autoAnswer) });
  }

  async runUntilPauseOrDone(
    missionId: string,
    options: { autoAnswer?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode }> {
    const cursor = this.mustCursor(missionId);
    const decisions = this.store.listDecisions(missionId);
    while (cursor.index < cursor.steps.length) {
      const step = cursor.steps[cursor.index];
      this.materializeMemory(missionId, step, decisions);
      const result = await this.runner.run({
        prompt: this.promptForStep(cursor.idea, step, decisions),
        cwd: this.paths.root,
        role: "maker",
        missionId,
        stepName: step,
        live: cursor.live
      });
      if (result.status === "error" || !result.proposedDecision) {
        this.store.updateMissionStatus(missionId, "failed");
        throw new Error(result.text || "Agent run failed to propose a decision");
      }
      const previous = decisions.at(-1);
      if (previous && result.proposedDecision.dependsOn.length === 0) {
        result.proposedDecision.dependsOn = [previous.id];
      }
      result.proposedDecision.citedSurfaces = [...result.proposedDecision.citedSurfaces, this.derivedSurface(step, missionId)];
      const decision = this.mcp.proposeDecision(result.proposedDecision);
      this.emitLatest();
      const gate = await this.gate.evaluate(decision);
      this.emitLatest();
      if (gate.verdict === "escalate") {
        this.store.updateMissionStatus(missionId, "waiting");
        this.store.cacheSet(cursorKey(missionId), { ...cursor, pendingDecisionId: decision.id });
        this.emitLatest();
        if (!options.autoAnswer) {
          return { mission: this.store.getMission(missionId)!, decisions: this.store.listDecisions(missionId), waiting: decision };
        }
        await this.answerEscalation(decision.id, { mode: "approve" }, { autoResume: false });
        return this.runUntilPauseOrDone(missionId, { autoAnswer: true });
      }
      this.completeStep(decision, step);
      decisions.push(decision);
      cursor.index += 1;
      cursor.pendingDecisionId = undefined;
      this.store.cacheSet(cursorKey(missionId), cursor);
      this.emitLatest();
      await delay(Number(process.env.AUTOPILOT_STEP_DELAY_MS ?? 450));
    }
    this.store.updateMissionStatus(missionId, "completed");
    this.emit(this.store.addEvent("mission.completed", missionId, { missionId, decisions: decisions.map((decision) => decision.id) }));
    return { mission: this.store.getMission(missionId)!, decisions: this.store.listDecisions(missionId) };
  }

  async answerEscalation(
    decisionId: string,
    answer: { mode: "approve" | "override"; choice?: string },
    options: { autoResume?: boolean } = {}
  ): Promise<{ mission: Mission; decisions: DecisionNode[]; waiting?: DecisionNode }> {
    const decision = this.mustDecision(decisionId);
    const cursor = this.mustCursor(decision.missionId);
    if (cursor.pendingDecisionId !== decision.id) throw new Error(`Decision ${decisionId} is not waiting for an answer`);
    if (answer.mode === "override" && answer.choice) {
      decision.choice = answer.choice;
      decision.rationale = `${decision.rationale}\n\nHuman override: ${answer.choice}`;
    }
    this.store.addEvent("gate.decided", decision.missionId, { decisionId, answer });
    this.completeStep(decision, cursor.steps[cursor.index]);
    cursor.index += 1;
    cursor.pendingDecisionId = undefined;
    this.store.cacheSet(cursorKey(decision.missionId), cursor);
    this.store.updateMissionStatus(decision.missionId, "running");
    this.emitLatest();
    if (options.autoResume === false) {
      return { mission: this.store.getMission(decision.missionId)!, decisions: this.store.listDecisions(decision.missionId) };
    }
    return this.runUntilPauseOrDone(decision.missionId);
  }

  async pivot(
    decisionId: string,
    newChoice: string
  ): Promise<{ worktree?: string; invalidated: string[]; reused: string[]; compare: { original: DecisionNode; branch: DecisionNode[]; changed: string[] } }> {
    const decision = this.store.getDecision(decisionId);
    if (!decision?.commitSha) throw new Error(`Decision ${decisionId} has no checkpoint`);
    const invalidated = this.store.invalidationSet(decisionId);
    const reused = this.store.reusedSet(decisionId, decision.missionId);
    if (process.env.AUTOPILOT_ENABLE_GIT_CHECKPOINTS === "1") {
      const worktree = this.worktrees.fork(`${decisionId}-${newChoice}`, decision.commitSha);
      for (const reusedId of reused) {
        const reusedDecision = this.store.getDecision(reusedId);
        if (reusedDecision?.commitSha) this.worktrees.replayCommit(reusedDecision.commitSha, worktree);
      }
      const compare = this.comparePayload(decision, invalidated, reused, newChoice);
      this.emit(this.store.addEvent("pivot.completed", decision.missionId, { decisionId, newChoice, worktree, invalidated, reused, compare }));
      return { worktree, invalidated, reused, compare };
    }
    const compare = this.comparePayload(decision, invalidated, reused, newChoice);
    this.emit(this.store.addEvent("pivot.completed", decision.missionId, { decisionId, newChoice, invalidated, reused, compare }));
    return { invalidated, reused, compare };
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

  private stepsForIdea(idea: string): string[] {
    if (/auth/i.test(idea)) return ["project-layout", "auth-strategy", "auth-persistence"];
    return ["mission-plan", "mission-implementation", "mission-handoff"];
  }

  private promptForStep(idea: string, step: string, decisions: DecisionNode[]): string {
    return [
      `You are the Autopilot Pilot running a bounded stepped loop.`,
      `Mission idea: ${idea}`,
      `Current step: ${step}`,
      `Prior decisions: ${decisions.map((decision) => `${decision.id}:${decision.choice}`).join(", ") || "none"}`,
      `End by proposing exactly one consequential decision as a JSON block with question, options, choice, rationale, citedEvidence, citedSurfaces, and dependsOn.`
    ].join("\n");
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

  private completeStep(decision: DecisionNode, step: string): void {
    this.writeMissionArtifact(decision.missionId, step, decision);
    decision.commitSha = this.worktrees.checkpoint(decision.id);
    decision.status = "implemented";
    this.store.updateDecision(decision);
  }

  private comparePayload(
    original: DecisionNode,
    invalidated: string[],
    reused: string[],
    newChoice: string
  ): { original: DecisionNode; branch: DecisionNode[]; changed: string[] } {
    const branch = invalidated
      .map((id) => this.store.getDecision(id))
      .filter((node): node is DecisionNode => Boolean(node))
      .map((node) => ({
        ...node,
        choice: node.id === original.id ? newChoice : node.choice,
        rationale: node.id === original.id ? `${node.rationale}\n\nPivot branch choice: ${newChoice}` : `${node.rationale}\n\nRe-run because it depends on ${original.id}.`
      }));
    return {
      original,
      branch,
      changed: [`Invalidated ${invalidated.length} node(s); reused ${reused.length} node(s).`]
    };
  }

  private derivedSurface(step: string, missionId: string): Surface {
    return {
      id: `derived:${step}`,
      kind: step.includes("auth") ? "auth-security" : step.includes("layout") ? "cross-cutting" : "project",
      source: "derived",
      locator: `missions/${missionId}/${step}.md`
    };
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

  private emit(event: EngineEvent): void {
    this.onEvent(event);
  }
}

interface MissionCursor {
  idea: string;
  steps: string[];
  index: number;
  live: boolean;
  pendingDecisionId?: string;
}

function cursorKey(missionId: string): string {
  return `mission-cursor:${missionId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
