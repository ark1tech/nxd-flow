import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAutopilot } from "./index.js";

describe("LoopEngine demo flow", () => {
  it("pauses on the auth strategy decision and resumes after approval", async () => {
    const ctx = setup();
    const first = await ctx.engine.startMission("Add authentication");
    expect(first.mission.status).toBe("waiting");
    expect(first.waiting?.question).toContain("JWT or sessions");

    const resumed = await ctx.engine.answerEscalation(first.waiting!.id, { mode: "approve" });
    expect(resumed.mission.status).toBe("completed");
    expect(resumed.decisions).toHaveLength(3);
    expect(ctx.store.listEvents().some((event) => event.type === "gate.escalated")).toBe(true);
    ctx.cleanup();
  });

  it("pivots the auth decision with graph-level invalidation and reuse", async () => {
    const ctx = setup();
    const result = await ctx.engine.startMission("Add authentication", { autoAnswer: true });
    const auth = result.decisions.find((decision) => decision.question.includes("JWT or sessions"))!;
    const pivot = await ctx.engine.pivot(auth.id, "sessions");

    expect(pivot.invalidated).toContain(auth.id);
    expect(pivot.reused.length).toBeGreaterThan(0);
    expect(pivot.branch.worktree).toBeTruthy();
    expect(pivot.compare.changed[0]).toContain("Invalidated");
    expect(pivot.branch.decisions.length).toBeGreaterThan(0);
    expect(pivot.branch.decisions.some((decision) => decision.choice === "sessions")).toBe(true);
    ctx.cleanup();
  });

  it("derives surfaces and dependency edges from real scratch file changes", async () => {
    const ctx = setup();
    const result = await ctx.engine.startMission("Add authentication", { autoAnswer: true });
    const auth = result.decisions.find((decision) => decision.question.includes("JWT or sessions"))!;
    const persistence = result.decisions.find((decision) => decision.question.includes("token/session state"))!;

    expect(auth.citedSurfaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "derived", locator: "src/autopilot-auth.ts" })])
    );
    expect(ctx.store.listEdges()).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: auth.id, to: persistence.id, kind: "derived" })])
    );
    ctx.cleanup();
  });

  it("turns scoped escalation overrides into proposed profile deltas", async () => {
    const ctx = setup();
    const first = await ctx.engine.startMission("Add authentication");

    await ctx.engine.answerEscalation(first.waiting!.id, { mode: "override", choice: "sessions", scope: "global" });

    expect(ctx.engine.profileRules().some((rule) => rule.text.includes("sessions"))).toBe(true);
    ctx.cleanup();
  });

  it("captures project knowledge from changed files and revalidates it against the scratch repo", async () => {
    const ctx = setup();
    await ctx.engine.startMission("Add authentication", { autoAnswer: true });

    const facts = ctx.engine.knowledgeFacts();

    expect(facts.some((fact) => fact.subject === "changed-file:src/autopilot-auth.ts")).toBe(true);
    expect(facts.every((fact) => ctx.engine.revalidateKnowledge(fact.id) !== "stale")).toBe(true);
    ctx.cleanup();
  });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-loop-"));
  const { store, engine } = createAutopilot(dir);
  return {
    store,
    engine,
    cleanup: () => {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
