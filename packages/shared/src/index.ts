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
  pros?: string[];
  cons?: string[];
  /** @deprecated use pros/cons */
  tradeoffs?: string[];
}

export interface DecisionNode {
  id: string;
  missionId: string;
  branchId?: string;
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
  stepId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MissionStep {
  id: string;
  name: string;
  description: string;
}

export type BranchStatus = "running" | "completed" | "failed";

export interface Branch {
  id: string;
  missionId: string;
  fromDecisionId: string;
  newChoice: string;
  worktree?: string;
  status: BranchStatus;
  decisions: DecisionNode[];
  invalidated: string[];
  reused: string[];
  diffStat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentActivity {
  kind: "planning" | "editing" | "testing" | "proposing" | "thinking" | "status";
  message: string;
  file?: string;
  stepId?: string;
  missionId?: string;
}

export interface PendingNode {
  id: string;
  missionId: string;
  stepId: string;
  stepName: string;
  label: string;
}

export type AgentRole = "planner" | "maker" | "auditor" | "scoper";

export interface HarnessRecord {
  id: string;
  missionId: string;
  stepId?: string;
  stepName: string;
  role: AgentRole;
  model: string;
  tools: string[];
  prompt: string;
  skills: string;
  profileRules: string[];
  rawResponse: string;
  durationMs: number;
  fallbackUsed: boolean;
  createdAt: string;
}

export interface ClarificationState {
  missionId: string;
  questions: string[];
  answers: string[];
  currentIndex: number;
}

export type FileGraphNodeStatus = "unchanged" | "modified" | "added" | "untracked";

export interface FileGraphNode {
  path: string;
  status: FileGraphNodeStatus;
  lastChangedByDecisionId?: string;
}

export interface FileGraphEdge {
  from: string;
  to: string;
}

export interface FileGraphSnapshot {
  missionId: string;
  branchId?: string;
  files: FileGraphNode[];
  imports: FileGraphEdge[];
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

export type WorktreeFileStatus = "modified" | "added" | "untracked" | "deleted";

export interface WorktreeEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  status?: WorktreeFileStatus;
  children?: WorktreeEntry[];
}

export interface MissionSummary extends Mission {
  decisionCount: number;
  scratchExists: boolean;
  scratchPath?: string;
}

export interface WorktreeSnapshot {
  missionId: string;
  root: string;
  displayPath: string;
  branchId?: string;
  branchLabel?: string;
  headSha?: string;
  changedFiles: string[];
  entries: WorktreeEntry[];
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
  trainingWheels?: boolean;
}

export interface GateResult {
  verdict: Verdict;
  evidence: GateEvidence;
}

export type EngineEventType =
  | "mission.started"
  | "clarification.requested"
  | "clarification.answered"
  | "mission.planned"
  | "mission.completed"
  | "step.started"
  | "agent.activity"
  | "node.pending"
  | "decision.proposed"
  | "decision.classified"
  | "gate.escalated"
  | "gate.decided"
  | "debt.updated"
  | "pivot.completed"
  | "branch.started"
  | "branch.node.proposed"
  | "branch.completed"
  | "knowledge.proposed"
  | "profile.delta.proposed";

export interface EngineEvent {
  id: string;
  type: EngineEventType;
  missionId?: string;
  payload: unknown;
  createdAt: string;
}

export interface DashboardSnapshot {
  missions: Mission[];
  decisions: DecisionNode[];
  edges: Edge[];
  events: EngineEvent[];
  branches: Branch[];
  pendingNodes: PendingNode[];
  activities: AgentActivity[];
  harnessRecords: HarnessRecord[];
  clarification?: ClarificationState;
  plan?: { missionId: string; steps: MissionStep[] };
  trainingWheels?: { enabled: boolean; ruleCount: number; requiredRules: number };
  profileRules?: ProfileRule[];
  knowledgeFacts?: KnowledgeFact[];
}

export type SkillRole = "planner" | "maker" | "auditor" | "scoper";

export interface SkillsSnapshot {
  planner: string;
  maker: string;
  auditor: string;
  scoper: string;
}

export type DashboardMessage =
  | { type: "state"; payload: DashboardSnapshot }
  | { type: "event"; payload: EngineEvent }
  | { type: "activity"; payload: AgentActivity }
  | { type: "pending"; payload: PendingNode }
  | { type: "pending.clear"; payload: { id: string } };
