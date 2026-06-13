import type { DecisionNode, Surface } from "@autopilot/shared";

export interface AgentRunRequest {
  prompt: string;
  cwd: string;
  role: "maker" | "auditor";
  missionId: string;
  stepName: string;
  live?: boolean;
}

export interface AgentRunResult {
  status: "finished" | "error";
  text: string;
  proposedDecision?: Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed">;
}

export class AgentRunner {
  constructor(private readonly model = "composer-2.5") {}

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    if (!request.live) return this.mockRun(request);
    try {
      const { Agent } = await import("@cursor/sdk");
      const result = await Agent.prompt(request.prompt, {
        apiKey: process.env.CURSOR_API_KEY,
        model: { id: this.model },
        local: { cwd: request.cwd }
      });
      const text = String((result as { result?: unknown }).result ?? "");
      return { status: "finished", text, proposedDecision: parseDecision(text, request) ?? this.mockDecision(request) };
    } catch (error) {
      return { status: "error", text: error instanceof Error ? error.message : String(error) };
    }
  }

  private async mockRun(request: AgentRunRequest): Promise<AgentRunResult> {
    return {
      status: "finished",
      text: `Mock ${request.role} completed ${request.stepName}`,
      proposedDecision: request.role === "maker" ? this.mockDecision(request) : undefined
    };
  }

  private mockDecision(request: AgentRunRequest): Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed"> {
    if (request.stepName === "project-layout") {
      return scriptedDecision(request, {
        question: "Where should authentication live in the fixture service?",
        options: [
          { id: "routes", label: "Keep auth in Fastify route handlers" },
          { id: "framework", label: "Introduce a separate auth framework layer" }
        ],
        choice: "routes",
        rationale: "Keep the demo auth path inside the existing Fastify fixture layout so the product remains easy to inspect.",
        surfaces: [{ id: "layout", kind: "cross-cutting", source: "cited", locator: "fixtures/ts-service/src/server.ts" }]
      });
    }
    if (request.stepName === "auth-strategy") {
      return scriptedDecision(request, {
        question: "Which auth strategy should the pilot choose: JWT or sessions?",
        options: [
          { id: "jwt", label: "JWT bearer tokens" },
          { id: "sessions", label: "Server-side sessions" }
        ],
        choice: "jwt",
        rationale: "JWT keeps the demo stateless, but it touches an auth-security boundary and is intentionally not covered by the profile so the loop pauses.",
        surfaces: [{ id: "auth-security", kind: "auth-security", source: "cited", locator: "fixtures/ts-service/src/server.ts" }]
      });
    }
    if (request.stepName === "auth-persistence") {
      return scriptedDecision(request, {
        question: "How should token/session state be represented for the fixture?",
        options: [
          { id: "in-memory-fixture", label: "In-memory fixture user store" },
          { id: "database", label: "Add a database-backed user/session table" }
        ],
        choice: "in-memory-fixture",
        rationale: "The fixture should stay inspectable: a tiny in-memory store is enough to demonstrate the branch without adding database setup.",
        surfaces: [{ id: "fixture-state", kind: "project", source: "cited", locator: "fixtures/ts-service/src/server.ts" }]
      });
    }
    const surfaces: Surface[] = [{ id: "project", kind: "project", source: "cited", locator: request.stepName }];
    return {
      missionId: request.missionId,
      question: `How should Autopilot handle ${request.stepName}?`,
      options: [
        { id: "a", label: "Stepped, grounded implementation" },
        { id: "b", label: "Ad-hoc implementation" }
      ],
      choice: "a",
      rationale: `Use the stepped, grounded path for ${request.stepName} so the DecisionGate can run before downstream work.`,
      citedEvidence: ["docs/adr/0006-orchestrator-stepped-loop.md", "docs/adr/0005-grounded-decisioning-evidence-vs-verdict.md"],
      citedSurfaces: surfaces,
      dependsOn: [],
      tier: "low",
      ruleFired: "unclassified",
      status: "proposed"
    };
  }
}

function scriptedDecision(
  request: AgentRunRequest,
  input: {
    question: string;
    options: Array<{ id: string; label: string }>;
    choice: string;
    rationale: string;
    surfaces: Surface[];
  }
): Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed"> {
  return {
    missionId: request.missionId,
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
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]) as Partial<DecisionNode>;
    if (!parsed.question || !parsed.choice || !parsed.rationale) return undefined;
    return {
      missionId: request.missionId,
      question: parsed.question,
      options: parsed.options ?? [{ id: "a", label: parsed.choice }],
      choice: parsed.choice,
      rationale: parsed.rationale,
      citedEvidence: parsed.citedEvidence ?? [],
      citedSurfaces: parsed.citedSurfaces ?? [],
      dependsOn: parsed.dependsOn ?? [],
      tier: parsed.tier ?? "low",
      ruleFired: parsed.ruleFired ?? "unclassified",
      status: "proposed"
    };
  } catch {
    return undefined;
  }
}
