import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentActivity, AgentRole, DecisionNode, HarnessRecord, MissionStep, Surface } from "@autopilot/shared";
import { loadAutopilotConfig, type AutopilotMode } from "./config.js";

export interface HarnessContext {
  skills: string;
  profileRules: string[];
  tools: string[];
  onRecord: (record: Omit<HarnessRecord, "id" | "createdAt">) => void;
}

export interface AgentRunRequest {
  prompt: string;
  cwd: string;
  role: AgentRole;
  missionId: string;
  stepName: string;
  stepId?: string;
  live?: boolean;
  resumeId?: string;
  harness?: HarnessContext;
  onActivity?: (activity: AgentActivity) => void;
}

export interface AgentRunResult {
  status: "finished" | "error";
  text: string;
  proposedDecision?: Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed">;
  plannedSteps?: MissionStep[];
  scopeResult?: { ready: true } | { ready: false; questions: string[] };
}

export interface InlineMcpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CursorAgentSession {
  send(prompt: string): Promise<CursorRun>;
  resume?(prompt: string): Promise<CursorRun>;
  dispose?(): Promise<void>;
}

export interface CursorRun {
  stream?(): AsyncIterable<StreamEvent>;
  wait(): Promise<{ status?: string; id?: string; result?: unknown; text?: unknown }>;
}

export interface StreamEvent {
  type?: string;
  message?: {
    content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
  };
}

export interface CursorAgentAdapter {
  create(options: Record<string, unknown>): Promise<CursorAgentSession>;
  resume?(resumeId: string, options: Record<string, unknown>): Promise<CursorAgentSession>;
}

export interface AgentRunnerOptions {
  mode?: AutopilotMode;
  cursorApiKey?: string;
  makerModel?: string;
  auditorModel?: string;
  mcp?: InlineMcpServerConfig;
  adapter?: CursorAgentAdapter;
}

const DECISION_JSON_SCHEMA = `{
  "question": "string",
  "options": [{"id":"a","label":"Label","pros":["..."], "cons":["..."]}],
  "choice": "recommended option id",
  "rationale": "Why the recommended option wins over alternatives",
  "citedEvidence": ["path/to/doc"],
  "citedSurfaces": [{"id":"surface-id","kind":"project","source":"cited","locator":"src/file.ts"}],
  "dependsOn": []
}`;

export class AgentRunner {
  private readonly options: Required<Omit<AgentRunnerOptions, "cursorApiKey" | "mcp">> & Pick<AgentRunnerOptions, "cursorApiKey" | "mcp">;

  constructor(options: AgentRunnerOptions | string = {}) {
    const config = loadAutopilotConfig();
    const normalized = typeof options === "string" ? { makerModel: options } : options;
    this.options = {
      mode: normalized.mode ?? config.mode,
      cursorApiKey: normalized.cursorApiKey ?? config.cursorApiKey,
      makerModel: normalized.makerModel ?? config.makerModel,
      auditorModel: normalized.auditorModel ?? config.auditorModel,
      mcp: normalized.mcp,
      adapter: normalized.adapter ?? defaultCursorAgentAdapter()
    };
  }

  isMockMode(live?: boolean): boolean {
    return !live || this.options.mode === "mock" || !this.options.cursorApiKey;
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    if (request.role === "scoper") {
      if (this.isMockMode(request.live)) return this.mockScope(request);
      return this.liveScope(request);
    }
    if (request.role === "planner") {
      if (this.isMockMode(request.live)) return this.mockPlan(request);
      return this.livePlan(request);
    }
    if (this.isMockMode(request.live)) return this.mockRun(request);
    return this.liveRun(request);
  }

  private async liveScope(request: AgentRunRequest): Promise<AgentRunResult> {
    return this.liveJsonCall(request, "scoping", (text) => {
      const parsed = parseScope(text);
      if (!parsed) return undefined;
      return { scopeResult: parsed };
    });
  }

  private async liveRun(request: AgentRunRequest): Promise<AgentRunResult> {
    return this.liveJsonCall(request, "decision", (text) => {
      const decision = parseDecision(text, request);
      if (!decision) return undefined;
      return { proposedDecision: decision };
    });
  }

  private async livePlan(request: AgentRunRequest): Promise<AgentRunResult> {
    return this.liveJsonCall(request, "plan", (text) => {
      const steps = parsePlan(text);
      if (!steps?.length) return undefined;
      return { plannedSteps: steps };
    });
  }

  private async liveJsonCall(
    request: AgentRunRequest,
    kind: "decision" | "plan" | "scoping",
    parse: (text: string) => Partial<AgentRunResult> | undefined
  ): Promise<AgentRunResult> {
    const started = Date.now();
    const emit = (activity: AgentActivity) => {
      request.onActivity?.({ ...activity, missionId: request.missionId, stepId: request.stepId });
    };
    emit({ kind: request.role === "planner" ? "planning" : "status", message: `${humanRoleLabel(request.role)}…`, stepId: request.stepId });

    const fullPrompt = this.buildPrompt(request);
    try {
      let text = await this.callLiveAgent(request, fullPrompt, emit);
      let parsed = parse(text);
      if (!parsed) {
        emit({ kind: "status", message: "Retrying with stricter JSON format…", stepId: request.stepId });
        text = await this.callLiveAgent(request, strictRetryPrompt(kind, text), emit);
        parsed = parse(text);
      }
      this.recordHarness(request, fullPrompt, text, Date.now() - started, false);
      if (!parsed) {
        return {
          status: "error",
          text: `Live ${request.role} did not return valid JSON. Enable offline mode or retry. Last output: ${text.slice(0, 280)}`
        };
      }
      if (kind === "decision") emit({ kind: "proposing", message: "Proposing decision…", stepId: request.stepId });
      return { status: "finished", text, ...parsed };
    } catch (error) {
      const message = isCursorAgentError(error) ? error.message : error instanceof Error ? error.message : String(error);
      this.recordHarness(request, fullPrompt, message, Date.now() - started, false);
      return { status: "error", text: message };
    }
  }

  private async callLiveAgent(
    request: AgentRunRequest,
    prompt: string,
    emit: (activity: AgentActivity) => void
  ): Promise<string> {
    const createOptions = this.createOptions(request);
    const agent =
      request.resumeId && this.options.adapter.resume
        ? await this.options.adapter.resume(request.resumeId, createOptions)
        : await this.options.adapter.create(createOptions);
    const run = normalizeRun(await agent.send(prompt));
    const text = await this.consumeStream(run, emit, request);
    const result = await run.wait();
    await agent.dispose?.();
    if (result.status === "error") throw new Error(text || `Run ${result.id ?? "unknown"} failed`);
    return text;
  }

  private buildPrompt(request: AgentRunRequest): string {
    const skillBlock = request.harness?.skills?.trim() ? `\n\n## Role skill\n${request.harness.skills.trim()}` : "";
    return `${request.prompt}${skillBlock}`;
  }

  private recordHarness(
    request: AgentRunRequest,
    prompt: string,
    rawResponse: string,
    durationMs: number,
    fallbackUsed: boolean
  ): void {
    request.harness?.onRecord({
      missionId: request.missionId,
      stepId: request.stepId,
      stepName: request.stepName,
      role: request.role,
      model: this.modelForRole(request.role),
      tools: request.harness?.tools ?? [],
      prompt,
      skills: request.harness?.skills ?? "",
      profileRules: request.harness?.profileRules ?? [],
      rawResponse,
      durationMs,
      fallbackUsed
    });
  }

  private async consumeStream(
    run: CursorRun,
    emit: (activity: AgentActivity) => void,
    request: AgentRunRequest
  ): Promise<string> {
    const chunks: string[] = [];
    if (!run.stream) {
      const result = await run.wait();
      return String(result.result ?? result.text ?? "");
    }
    for await (const event of run.stream()) {
      const activity = activityFromStreamEvent(event, request.stepName);
      if (activity) emit(activity);
      if (event.type === "assistant") {
        for (const block of event.message?.content ?? []) {
          if (block.type === "text" && block.text) chunks.push(block.text);
        }
      }
    }
    return chunks.join("");
  }

  private createOptions(request: AgentRunRequest): Record<string, unknown> {
    return {
      apiKey: this.options.cursorApiKey,
      model: { id: this.modelForRole(request.role) },
      local: { cwd: request.cwd },
      ...(this.options.mcp ? { mcpServers: { autopilot: this.options.mcp } } : {})
    };
  }

  private modelForRole(role: AgentRole): string {
    return role === "auditor" ? this.options.auditorModel : this.options.makerModel;
  }

  private async mockRun(request: AgentRunRequest): Promise<AgentRunResult> {
    const started = Date.now();
    request.onActivity?.({
      kind: "status",
      message: `[Offline] ${humanStepLabel(request.stepName)}`,
      missionId: request.missionId,
      stepId: request.stepId
    });
    if (request.role === "maker") materializeMockCode(request);
    await delay(120);
    request.onActivity?.({ kind: "proposing", message: "Recording decision…", missionId: request.missionId, stepId: request.stepId });
    const text = `[Offline mock] ${request.role} completed ${request.stepName}`;
    this.recordHarness(request, request.prompt, text, Date.now() - started, true);
    return {
      status: "finished",
      text,
      proposedDecision: request.role === "maker" ? this.mockDecision(request) : undefined
    };
  }

  private mockScope(request: AgentRunRequest): AgentRunResult {
    const started = Date.now();
    request.onActivity?.({ kind: "planning", message: "[Offline] Checking scope…", missionId: request.missionId });
    const idea = request.prompt;
    const underspecified = /website|site|app|build me|make me/i.test(idea) && !/\b(next|react|vue|svelte|landing|portfolio|blog|ecommerce|store)\b/i.test(idea);
    const result = underspecified
      ? { ready: false as const, questions: ["What kind of website do you want (landing page, portfolio, blog, store)?", "Any stack preference (Next.js, plain HTML, etc.)?"] }
      : { ready: true as const };
    const text = JSON.stringify(result);
    this.recordHarness(request, request.prompt, text, Date.now() - started, true);
    return { status: "finished", text, scopeResult: result };
  }

  private mockPlan(request: AgentRunRequest): AgentRunResult {
    const started = Date.now();
    request.onActivity?.({ kind: "planning", message: "[Offline] Planning steps…", missionId: request.missionId });
    const text = "[Offline] Mock plan ready";
    this.recordHarness(request, request.prompt, text, Date.now() - started, true);
    return {
      status: "finished",
      text,
      plannedSteps: mockStepsForIdea(extractIdeaFromPlanPrompt(request.prompt))
    };
  }

  private mockDecision(request: AgentRunRequest): Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed"> {
    const stepName = request.stepName;
    if (stepName === "project-layout") {
      return scriptedDecision(request, {
        question: "Where should authentication live in the fixture service?",
        options: [
          option("routes", "Keep auth in Fastify route handlers", ["Minimal change to existing layout", "Easy to inspect in demo"], ["Couples auth to HTTP layer"]),
          option("framework", "Introduce a separate auth framework layer", ["Cleaner separation", "Easier to swap auth later"], ["More files and indirection for a demo"])
        ],
        choice: "routes",
        rationale: "Route handlers keep the demo auth path inside the existing Fastify layout — simpler to inspect than adding a framework layer.",
        surfaces: [{ id: "layout", kind: "cross-cutting", source: "cited", locator: "fixtures/ts-service/src/server.ts" }]
      });
    }
    if (stepName === "auth-strategy") {
      return scriptedDecision(request, {
        question: "Which auth strategy should the pilot choose: JWT or sessions?",
        options: [
          option("jwt", "JWT bearer tokens", ["Stateless", "Works well with SPAs"], ["Harder to revoke", "Touches auth-security boundary"]),
          option("sessions", "Server-side sessions", ["Easy revocation", "Familiar cookie model"], ["Needs session store", "More server state"])
        ],
        choice: request.prompt.includes("sessions") ? "sessions" : "jwt",
        rationale: request.prompt.includes("sessions")
          ? "Branch override selected server-side sessions for the fixture auth path."
          : "JWT keeps the demo stateless and fits the fixture, but it is uncovered by profile rules so the gate escalates.",
        surfaces: [{ id: "auth-security", kind: "auth-security", source: "cited", locator: "fixtures/ts-service/src/server.ts" }]
      });
    }
    if (stepName === "auth-persistence") {
      const sessions = request.prompt.includes("sessions");
      return scriptedDecision(request, {
        question: "How should token/session state be represented for the fixture?",
        options: [
          option("in-memory-fixture", "In-memory fixture user store", ["Zero setup", "Easy to inspect"], ["Not durable", "Lost on restart"]),
          option("database", "Add a database-backed user/session table", ["Durable sessions", "Production-like"], ["Adds DB dependency", "Heavier demo"])
        ],
        choice: sessions ? "database" : "in-memory-fixture",
        rationale: sessions
          ? "Sessions need durable storage, so a database-backed table is the coherent follow-on."
          : "An in-memory store keeps the fixture inspectable without database setup.",
        surfaces: [{ id: "fixture-state", kind: "project", source: "cited", locator: "fixtures/ts-service/src/server.ts" }]
      });
    }
    if (stepName === "site-stack") {
      return scriptedDecision(request, {
        question: "Which stack should we use for the personal website?",
        options: [
          option("next", "Next.js App Router", ["Polished pages with SSR", "Strong component ecosystem"], ["More setup than plain HTML"]),
          option("html", "Plain HTML/CSS/JS", ["Zero build step", "Easy to host anywhere"], ["No component reuse", "Manual routing"]),
          option("vite-react", "Vite + React SPA", ["Fast dev server", "Component model without SSR complexity"], ["Client-only by default"])
        ],
        choice: "next",
        rationale: "Next.js delivers a polished personal site quickly with minimal config and room to grow.",
        surfaces: [{ id: "site-stack", kind: "project", source: "cited", locator: "src/app/page.tsx" }]
      });
    }
    if (stepName === "site-pages") {
      return scriptedDecision(request, {
        question: "What pages and navigation should the site include?",
        options: [
          option("classic", "Home · About · Gallery · Contact", ["Covers a personal site narrative", "Simple top nav"], ["No blog or extras"]),
          option("story", "Single-page scroll sections", ["One URL to share", "Mobile-friendly storytelling"], ["Less SEO depth per topic"]),
          option("blog", "Home · About · Blog · Contact", ["Room to add updates over time"], ["More content to maintain"])
        ],
        choice: "classic",
        rationale: "A classic four-page layout fits a personal site — easy to browse and share.",
        surfaces: [{ id: "site-pages", kind: "project", source: "cited", locator: "src/app/layout.tsx" }]
      });
    }
    if (stepName === "site-auth") {
      return scriptedDecision(request, {
        question: "How should Google sign-in work on the site?",
        options: [
          option("nextauth", "NextAuth.js Google provider", ["Cookie sessions", "Well-documented for Next.js"], ["Adds auth dependency"]),
          option("firebase", "Firebase Auth Google popup", ["Hosted auth UI", "Quick setup"], ["Firebase lock-in"]),
          option("none", "Skip auth for now", ["Fastest demo path", "No secrets to manage"], ["No protected areas"])
        ],
        choice: "nextauth",
        rationale: "NextAuth integrates cleanly with Next.js and supports Google OAuth for any private pages later.",
        surfaces: [{ id: "site-auth", kind: "auth-security", source: "cited", locator: "src/app/api/auth/[...nextauth]/route.ts" }]
      });
    }
    const stepGoal = request.prompt.match(/Step goal:\s*(.+)/i)?.[1]?.trim();
    const surfaces: Surface[] = [{ id: "project", kind: "project", source: "cited", locator: stepName }];
    return {
      missionId: request.missionId,
      stepId: request.stepId,
      question: stepGoal ?? `How should we approach ${stepName.replace(/-/g, " ")}?`,
      options: [
        option("a", "Stepped, grounded implementation", ["Gate runs before downstream work", "Decisions are logged"], ["Slower than ad-hoc"]),
        option("b", "Ad-hoc implementation", ["Fast path", "Minimal ceremony"], ["No decision trail", "Harder to pivot"])
      ],
      choice: "a",
      rationale: "The stepped path keeps decisions visible and gate-checked before downstream work.",
      citedEvidence: ["docs/adr/0006-orchestrator-stepped-loop.md", "docs/adr/0005-grounded-decisioning-evidence-vs-verdict.md"],
      citedSurfaces: surfaces,
      dependsOn: [],
      tier: "low",
      ruleFired: "unclassified",
      status: "proposed"
    };
  }
}

function option(id: string, label: string, pros: string[], cons: string[]): { id: string; label: string; pros: string[]; cons: string[] } {
  return { id, label, pros, cons };
}

function normalizeRun(run: unknown): CursorRun {
  if (run && typeof (run as CursorRun).wait === "function") return run as CursorRun;
  const plain = run as { result?: unknown; text?: unknown; status?: string; id?: string };
  return {
    async wait() {
      return plain;
    }
  };
}

function defaultCursorAgentAdapter(): CursorAgentAdapter {
  return {
    async create(options: Record<string, unknown>) {
      const { Agent } = await import("@cursor/sdk");
      const maybeAgent = Agent as unknown as {
        create?: (options: Record<string, unknown>) => Promise<CursorAgentSession>;
        prompt?: (prompt: string, options: Record<string, unknown>) => Promise<{ result?: unknown; text?: unknown; status?: string }>;
      };
      if (maybeAgent.create) return maybeAgent.create(options);
      return {
        async send(prompt: string) {
          if (!maybeAgent.prompt) throw new Error("Cursor SDK Agent.create/prompt API unavailable");
          const result = await maybeAgent.prompt(prompt, options);
          return {
            async wait() {
              return result;
            }
          };
        }
      };
    },
    async resume(resumeId: string, options: Record<string, unknown>) {
      const { Agent } = await import("@cursor/sdk");
      const maybeAgent = Agent as unknown as {
        resume?: (resumeId: string, options: Record<string, unknown>) => Promise<CursorAgentSession>;
        create?: (options: Record<string, unknown>) => Promise<CursorAgentSession>;
      };
      if (!maybeAgent.resume) {
        if (!maybeAgent.create) throw new Error("Cursor SDK Agent.resume/create API unavailable");
        return maybeAgent.create(options);
      }
      return maybeAgent.resume(resumeId, options);
    }
  };
}

function materializeMockCode(request: AgentRunRequest): void {
  const src = join(request.cwd, "src");
  mkdirSync(src, { recursive: true });
  const sessions = request.prompt.includes("sessions") || request.prompt.includes("Branch override");
  if (request.stepName === "project-layout") {
    writeFileSync(join(src, "autopilot-layout.ts"), "export const autopilotAuthHome = 'fastify-routes';\n");
    return;
  }
  if (request.stepName === "auth-strategy") {
    writeFileSync(join(src, "autopilot-auth.ts"), `export const autopilotAuthStrategy = '${sessions ? "sessions" : "jwt"}';\n`);
    return;
  }
  if (request.stepName === "auth-persistence") {
    writeFileSync(
      join(src, "autopilot-auth.ts"),
      sessions
        ? "export const autopilotAuthStrategy = 'sessions';\nexport const autopilotAuthPersistence = 'database';\n"
        : "export const autopilotAuthStrategy = 'jwt';\nexport const autopilotAuthPersistence = 'in-memory-fixture';\n"
    );
    return;
  }
  writeFileSync(join(src, `${request.stepName}.ts`), `export const autopilotStep = ${JSON.stringify(request.stepName)};\n`);
}

function scriptedDecision(
  request: AgentRunRequest,
  input: {
    question: string;
    options: Array<{ id: string; label: string; pros: string[]; cons: string[] }>;
    choice: string;
    rationale: string;
    surfaces: Surface[];
  }
): Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed"> {
  return {
    missionId: request.missionId,
    stepId: request.stepId,
    question: input.question,
    options: input.options,
    choice: input.choice,
    rationale: input.rationale,
    citedEvidence: ["docs/prd/autopilot-mvp-v1.md", "docs/adr/0006-orchestrator-stepped-loop.md"],
    citedSurfaces: input.surfaces,
    dependsOn: [],
    tier: "low",
    ruleFired: "unclassified",
    status: "proposed"
  };
}

function parseDecision(text: string, request: AgentRunRequest): Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed"> | undefined {
  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") return undefined;
  const body = parsed as Partial<DecisionNode> & { options?: Array<{ id?: string; label?: string; pros?: string[]; cons?: string[] }> };
  if (!body.question || !body.choice || !body.rationale || !Array.isArray(body.options) || body.options.length < 2) return undefined;
  const options = body.options.map((opt, index) => ({
    id: opt.id ?? `opt-${index}`,
    label: opt.label ?? String(opt.id ?? index),
    pros: opt.pros ?? [],
    cons: opt.cons ?? []
  }));
  if (!options.some((opt) => opt.id === body.choice)) return undefined;
  if (!options.every((opt) => opt.pros.length > 0 && opt.cons.length > 0)) return undefined;
  return {
    missionId: request.missionId,
    stepId: request.stepId,
    question: body.question,
    options,
    choice: body.choice,
    rationale: body.rationale,
    citedEvidence: body.citedEvidence ?? [],
    citedSurfaces: body.citedSurfaces ?? [],
    dependsOn: body.dependsOn ?? [],
    tier: body.tier ?? "low",
    ruleFired: body.ruleFired ?? "unclassified",
    status: "proposed"
  };
}

function parsePlan(text: string): MissionStep[] | undefined {
  const parsed = extractJson(text) as { steps?: Array<{ id?: string; name?: string; description?: string }> } | undefined;
  if (!parsed?.steps?.length) return undefined;
  return parsed.steps.slice(0, 6).map((step, index) => ({
    id: step.id ?? `step-${index + 1}`,
    name: step.name ?? `step-${index + 1}`,
    description: step.description ?? step.name ?? `Step ${index + 1}`
  }));
}

function parseScope(text: string): { ready: true } | { ready: false; questions: string[] } | undefined {
  const parsed = extractJson(text) as { ready?: boolean; questions?: string[] } | undefined;
  if (!parsed || typeof parsed.ready !== "boolean") return undefined;
  if (parsed.ready) return { ready: true };
  const questions = (parsed.questions ?? []).filter((q) => q.trim().length > 0).slice(0, 3);
  if (questions.length === 0) return undefined;
  return { ready: false, questions };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function strictRetryPrompt(kind: "decision" | "plan" | "scoping", prior: string): string {
  if (kind === "plan") {
    return `Your previous response was not valid JSON. Return ONLY one fenced JSON block:\n\`\`\`json\n{"steps":[{"id":"step-1","name":"kebab-name","description":"what this step decides"}]}\n\`\`\`\nPrevious output:\n${prior.slice(0, 500)}`;
  }
  if (kind === "scoping") {
    return `Return ONLY one fenced JSON block:\n\`\`\`json\n{"ready":true}\n\`\`\`\nor\n\`\`\`json\n{"ready":false,"questions":["one question"]}\n\`\`\`\nPrevious output:\n${prior.slice(0, 500)}`;
  }
  return `Your previous response was not valid JSON. Return ONLY one fenced JSON block matching:\n${DECISION_JSON_SCHEMA}\nEach option needs at least one pro and one con.\nPrevious output:\n${prior.slice(0, 500)}`;
}

function mockStepsForIdea(idea: string): MissionStep[] {
  if (/auth/i.test(idea)) {
    return [
      { id: "layout", name: "project-layout", description: "Decide where authentication lives in the fixture service" },
      { id: "strategy", name: "auth-strategy", description: "Choose JWT vs server-side sessions for the fixture" },
      { id: "persistence", name: "auth-persistence", description: "Choose how token/session state is represented" }
    ];
  }
  if (/website|site|landing|portfolio|blog/i.test(idea)) {
    return [
      { id: "stack", name: "site-stack", description: "Choose the site stack and rendering approach" },
      { id: "pages", name: "site-pages", description: "Decide core pages and navigation structure" },
      { id: "auth", name: "site-auth", description: "Choose how Google auth integrates with the site" }
    ];
  }
  return [
    { id: "plan", name: "mission-plan", description: "Plan the architecture and boundaries for the feature" },
    { id: "implement", name: "mission-implementation", description: "Implement the core feature with consequential decisions surfaced" },
    { id: "handoff", name: "mission-handoff", description: "Record deviations, tradeoffs, and handoff notes" }
  ];
}

function extractIdeaFromPlanPrompt(prompt: string): string {
  const match = prompt.match(/Mission idea:\s*(.+)/i);
  return match?.[1]?.trim() ?? prompt;
}

function activityFromStreamEvent(event: StreamEvent, stepName: string): AgentActivity | undefined {
  if (event.type !== "assistant") return undefined;
  for (const block of event.message?.content ?? []) {
    if (block.type === "text" && block.text) {
      const text = block.text.trim();
      if (!text) continue;
      if (/test|vitest|tsc/i.test(text)) return { kind: "testing", message: `Running checks for ${stepName}` };
      if (/edit|write|update|create/i.test(text)) return { kind: "editing", message: `Editing code for ${stepName}` };
      return { kind: "thinking", message: text.slice(0, 120) };
    }
    if (block.type === "tool_use" || block.name) {
      const name = block.name ?? "tool";
      if (/read|edit|write|search/i.test(name)) {
        const input = block.input as { path?: string; file?: string } | undefined;
        const file = input?.path ?? input?.file;
        return { kind: "editing", message: `${name} ${file ?? ""}`.trim(), file };
      }
      if (/test|shell|terminal/i.test(name)) return { kind: "testing", message: `Running ${name}` };
      return { kind: "status", message: `Using ${name}` };
    }
  }
  return undefined;
}

function isCursorAgentError(error: unknown): error is { message: string; isRetryable?: boolean } {
  return Boolean(error && typeof error === "object" && "message" in error && error.constructor?.name === "CursorAgentError");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanStepLabel(stepName: string): string {
  const labels: Record<string, string> = {
    "project-layout": "Deciding where auth lives…",
    "auth-strategy": "Choosing auth strategy…",
    "auth-persistence": "Choosing session storage…",
    "site-stack": "Choosing site stack…",
    "site-pages": "Planning pages…",
    "site-auth": "Planning Google auth integration…",
    "mission-plan": "Planning architecture…",
    "mission-implementation": "Implementing feature…",
    "mission-handoff": "Writing handoff…"
  };
  return labels[stepName] ?? `Working on ${stepName.replace(/-/g, " ")}…`;
}

function humanRoleLabel(role: AgentRole): string {
  return { scoper: "Checking scope", planner: "Planning mission steps", maker: "Running step", auditor: "Auditing decision" }[role];
}
