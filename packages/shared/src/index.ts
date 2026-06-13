export type BlastRadiusTier = "low" | "medium" | "high" | "critical";
export type EdgeKind = "declared" | "derived" | "checked";
export type DecisionStatus = "proposed" | "decided" | "escalated" | "implemented";
export type Verdict = "decide" | "escalate";
export type KnowledgeStatus = "active" | "hint-only" | "contested" | "stale";
export type LocatorKind = "file-symbol" | "pattern" | "command";

export interface Surface {
  id: string;
  kind:
    | "schema"
    | "public-api"
    | "auth-security"
    | "money"
    | "data-lifecycle"
    | "foundational-dependency"
    | "cross-cutting"
    | "project";
  source: "cited" | "derived";
  locator?: string;
}

export interface DecisionOption {
  id: string;
  label: string;
  tradeoffs?: string[];
}

export interface DecisionNode {
  id: string;
  missionId: string;
  question: string;
  options: DecisionOption[];
  choice: string;
  rationale: string;
  citedEvidence: string[];
  citedSurfaces: Surface[];
  dependsOn: string[];
  tier: BlastRadiusTier;
  ruleFired: string;
  status: DecisionStatus;
  reviewed: boolean;
  commitSha?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  evidence?: string;
}

export interface Mission {
  id: string;
  idea: string;
  status: "created" | "running" | "waiting" | "completed" | "failed";
  branchName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRule {
  id: string;
  scope: "global" | "context";
  text: string;
  weight: number;
  provisional: boolean;
  evidence?: string;
}

export interface KnowledgeLocator {
  kind: LocatorKind;
  locator: string;
  expected?: string;
}

export interface KnowledgeFact {
  id: string;
  subject: string;
  claim: string;
  status: KnowledgeStatus;
  locator?: KnowledgeLocator;
  provenance: {
    missionId?: string;
    decisionId?: string;
    file?: string;
    note: string;
  };
  confidence: number;
  lastConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GateEvidence {
  tier: BlastRadiusTier;
  ruleFired: string;
  coverage: "covered" | "uncovered";
  coverageEvidence: string[];
  auditor: "skipped" | "ok" | "flagged";
  auditorReason?: string;
  budgetExhausted?: boolean;
}

export interface GateResult {
  verdict: Verdict;
  evidence: GateEvidence;
}

export interface EngineEvent {
  id: string;
  type:
    | "mission.started"
    | "mission.completed"
    | "decision.proposed"
    | "decision.classified"
    | "gate.escalated"
    | "gate.decided"
    | "debt.updated"
    | "pivot.completed"
    | "knowledge.proposed";
  missionId?: string;
  payload: unknown;
  createdAt: string;
}
