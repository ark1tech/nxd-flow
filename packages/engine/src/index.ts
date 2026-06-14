export { AgentRunner } from "./agent-runner.js";
export { AutopilotMcpServer } from "./autopilot-mcp.js";
export { BlastRadiusClassifier } from "./blast-radius.js";
export { loadAutopilotConfig } from "./config.js";
export type { AutopilotConfig, AutopilotMode } from "./config.js";
export { DashboardGateway } from "./dashboard-gateway.js";
export { DecisionGate, MockAuditor, SdkAuditor } from "./decision-gate.js";
export { DecisionStore } from "./decision-store.js";
export { calculateDebt } from "./debt-meter.js";
export { deriveFileOverlapEdges } from "./edge-deriver.js";
export { KnowledgeStore } from "./knowledge-store.js";
export { LoopEngine } from "./loop-engine.js";
export { ProfileStore } from "./profile-store.js";
export { ensureAutopilotLayout, resolveMissionSource, resolveMissionSourceForIdea, resolvePaths, resolveWorkspaceRoot } from "./paths.js";
export { WorktreeManager } from "./worktree-manager.js";
export { SkillsStore } from "./skills-store.js";

import { BlastRadiusClassifier } from "./blast-radius.js";
import { AgentRunner } from "./agent-runner.js";
import { loadAutopilotConfig } from "./config.js";
import { DashboardGateway } from "./dashboard-gateway.js";
import { MockAuditor, SdkAuditor } from "./decision-gate.js";
import { DecisionStore } from "./decision-store.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { LoopEngine } from "./loop-engine.js";
import { ProfileStore } from "./profile-store.js";
import { ensureAutopilotLayout, resolveMissionSourceForIdea } from "./paths.js";

export function createAutopilot(startRoot = process.cwd()): { store: DecisionStore; engine: LoopEngine; gateway: DashboardGateway } {
  const paths = ensureAutopilotLayout(startRoot);
  const root = paths.root;
  const config = loadAutopilotConfig(root);
  const store = new DecisionStore(paths.db);
  const profile = new ProfileStore(paths.profile, paths.profileHistory);
  const knowledge = new KnowledgeStore(paths.knowledge, root);
  const classifier = BlastRadiusClassifier.fromFile(paths.policy);
  const runner = new AgentRunner({
    mode: config.mode,
    cursorApiKey: config.cursorApiKey,
    makerModel: config.makerModel,
    auditorModel: config.auditorModel,
    mcp: {
      command: "pnpm",
      args: ["--filter", "@autopilot/mcp", "exec", "autopilot-mcp"],
      env: { AUTOPILOT_ROOT: root }
    }
  });
  const auditor = config.mode === "live" ? new SdkAuditor(runner, root, true) : new MockAuditor();
  const engine = new LoopEngine(store, paths, profile, knowledge, classifier, runner, auditor);
  const gateway = new DashboardGateway(store, engine);
  return { store, engine, gateway };
}
