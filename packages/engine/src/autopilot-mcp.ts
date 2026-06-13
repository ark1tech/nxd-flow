import type { DecisionNode, KnowledgeFact, Surface } from "@autopilot/shared";
import type { DecisionStore } from "./decision-store.js";
import type { KnowledgeStore } from "./knowledge-store.js";
import type { ProfileStore } from "./profile-store.js";

export class AutopilotMcpServer {
  constructor(
    private readonly store: DecisionStore,
    private readonly profile: ProfileStore,
    private readonly knowledge: KnowledgeStore
  ) {}

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
