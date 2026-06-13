export { AgentRunner } from "./agent-runner.js";
export { AutopilotMcpServer } from "./autopilot-mcp.js";
export { BlastRadiusClassifier } from "./blast-radius.js";
export { DashboardGateway } from "./dashboard-gateway.js";
export { DecisionGate, MockAuditor } from "./decision-gate.js";
export { DecisionStore } from "./decision-store.js";
export { calculateDebt } from "./debt-meter.js";
export { deriveFileOverlapEdges } from "./edge-deriver.js";
export { KnowledgeStore } from "./knowledge-store.js";
export { LoopEngine } from "./loop-engine.js";
export { ProfileStore } from "./profile-store.js";
export { ensureAutopilotLayout, resolvePaths } from "./paths.js";
export { WorktreeManager } from "./worktree-manager.js";

import { BlastRadiusClassifier } from "./blast-radius.js";
import { DashboardGateway } from "./dashboard-gateway.js";
import { DecisionStore } from "./decision-store.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { LoopEngine } from "./loop-engine.js";
import { ProfileStore } from "./profile-store.js";
import { ensureAutopilotLayout } from "./paths.js";

export function createAutopilot(root = process.cwd()): { store: DecisionStore; engine: LoopEngine; gateway: DashboardGateway } {
  const paths = ensureAutopilotLayout(root);
  const store = new DecisionStore(paths.db);
  const profile = new ProfileStore(paths.profile, paths.profileHistory);
  const knowledge = new KnowledgeStore(paths.knowledge, root);
  const classifier = BlastRadiusClassifier.fromFile(paths.policy);
  const engine = new LoopEngine(store, paths, profile, knowledge, classifier);
  const gateway = new DashboardGateway(store, engine);
  return { store, engine, gateway };
}
