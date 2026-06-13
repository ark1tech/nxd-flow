import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DecisionNode, KnowledgeFact, Surface } from "@autopilot/shared";
import type { DecisionStore } from "./decision-store.js";
import type { KnowledgeStore } from "./knowledge-store.js";
import type { ProfileStore } from "./profile-store.js";

export class AutopilotMcpServer {
  constructor(
    private readonly store: DecisionStore,
    private readonly profile: ProfileStore,
    private readonly knowledge: KnowledgeStore,
    private readonly paths: { memoryRoot?: string; handoffRoot?: string } = {}
  ) {}

  toolNames(): string[] {
    return [
      "propose_decision",
      "cite_surfaces",
      "cite_dependencies",
      "get_profile",
      "coverage_for",
      "propose_knowledge",
      "read_memory",
      "read_knowledge",
      "record_handoff",
      "read_state"
    ];
  }

  callTool(name: string, input: unknown): unknown {
    switch (name) {
      case "propose_decision":
        return this.proposeDecision(input as Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed">);
      case "cite_surfaces": {
        const args = input as { decisionId: string; surfaces: Surface[] };
        return this.citeSurfaces(args.decisionId, args.surfaces);
      }
      case "cite_dependencies": {
        const args = input as { decisionId: string; dependsOn: string[] };
        return this.citeDependencies(args.decisionId, args.dependsOn);
      }
      case "get_profile":
        return this.profile.effectiveRules();
      case "coverage_for": {
        const args = input as { decisionId?: string; text?: string };
        return args.decisionId ? this.coverageFor(args.decisionId) : this.profile.coverageFor({ question: args.text ?? "", choice: "", rationale: "" });
      }
      case "propose_knowledge":
        return this.proposeKnowledge(input as Omit<KnowledgeFact, "id" | "status" | "confidence" | "createdAt" | "updatedAt">);
      case "read_memory":
        return this.readMemory((input as { missionId?: string } | undefined)?.missionId);
      case "read_knowledge":
        return this.knowledge.list();
      case "record_handoff": {
        const args = input as { missionId: string; step: string; body: string };
        return this.recordHandoff(args.missionId, args.step, args.body);
      }
      case "read_state":
        return this.readState((input as { missionId?: string } | undefined)?.missionId);
      default:
        throw new Error(`Unknown Autopilot MCP tool: ${name}`);
    }
  }

  proposeDecision(input: Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed">): DecisionNode {
    return this.store.addDecision(input);
  }

  citeSurfaces(decisionId: string, surfaces: Surface[]): DecisionNode {
    const decision = this.mustDecision(decisionId);
    decision.citedSurfaces = mergeSurfaces(decision.citedSurfaces, surfaces);
    this.store.updateDecision(decision);
    return decision;
  }

  citeDependencies(decisionId: string, dependsOn: string[]): DecisionNode {
    const decision = this.mustDecision(decisionId);
    decision.dependsOn = [...new Set([...decision.dependsOn, ...dependsOn])];
    for (const dep of dependsOn) {
      this.store.addEdge({ from: dep, to: decision.id, kind: "declared", evidence: "MCP cite_dependencies" });
    }
    this.store.updateDecision(decision);
    return decision;
  }

  coverageFor(decisionId: string): { status: "covered" | "uncovered"; evidence: string[] } {
    return this.profile.coverageFor(this.mustDecision(decisionId));
  }

  proposeKnowledge(input: Omit<KnowledgeFact, "id" | "status" | "confidence" | "createdAt" | "updatedAt">): KnowledgeFact {
    const fact = this.knowledge.propose(input);
    this.store.addEvent("knowledge.proposed", input.provenance.missionId, fact);
    return fact;
  }

  readState(missionId?: string): unknown {
    return {
      missions: this.store.listMissions(),
      decisions: this.store.listDecisions(missionId),
      edges: this.store.listEdges()
    };
  }

  readMemory(missionId?: string): string {
    if (!this.paths.memoryRoot) return "";
    const root = missionId ? join(this.paths.memoryRoot, missionId) : this.paths.memoryRoot;
    if (!existsSync(root)) return "";
    return readdirSync(root)
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n---\n");
  }

  recordHandoff(missionId: string, step: string, body: string): { path: string } {
    const root = this.paths.handoffRoot ?? this.paths.memoryRoot ?? ".";
    const path = join(root, missionId, `${step}.md`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    return { path };
  }

  private mustDecision(id: string): DecisionNode {
    const decision = this.store.getDecision(id);
    if (!decision) throw new Error(`Decision not found: ${id}`);
    return decision;
  }
}

function mergeSurfaces(existing: Surface[], incoming: Surface[]): Surface[] {
  const byKey = new Map<string, Surface>();
  for (const surface of [...existing, ...incoming]) {
    byKey.set(`${surface.kind}:${surface.source}:${surface.locator ?? surface.id}`, surface);
  }
  return [...byKey.values()];
}
