import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AutopilotMcpServer } from "./autopilot-mcp.js";
import { DecisionStore } from "./decision-store.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { ProfileStore } from "./profile-store.js";

describe("AutopilotMcpServer", () => {
  it("exposes the planned Autopilot tool surface", () => {
    const ctx = setup();

    expect(ctx.mcp.toolNames()).toEqual([
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
    ]);
    ctx.cleanup();
  });

  it("can call propose_decision through the generic tool interface", () => {
    const ctx = setup();
    const mission = ctx.store.createMission("Add auth");

    const result = ctx.mcp.callTool("propose_decision", {
      missionId: mission.id,
      question: "Auth strategy?",
      options: [{ id: "jwt", label: "JWT" }],
      choice: "jwt",
      rationale: "Keep the fixture stateless.",
      citedEvidence: ["docs/prd/autopilot-mvp-v1.md"],
      citedSurfaces: [{ id: "auth", kind: "auth-security", source: "cited" }],
      dependsOn: [],
      tier: "low",
      ruleFired: "unclassified",
      status: "proposed"
    });

    expect(ctx.store.listDecisions(mission.id)).toHaveLength(1);
    expect(result).toMatchObject({ question: "Auth strategy?", choice: "jwt" });
    ctx.cleanup();
  });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-mcp-"));
  const store = new DecisionStore(join(dir, "state.sqlite"));
  const profile = new ProfileStore(join(dir, "PROFILE.md"), join(dir, "history"));
  const knowledge = new KnowledgeStore(join(dir, "PROJECT.md"), dir);
  return {
    store,
    mcp: new AutopilotMcpServer(store, profile, knowledge, { memoryRoot: join(dir, "memory"), handoffRoot: join(dir, "handoffs") }),
    cleanup: () => {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
