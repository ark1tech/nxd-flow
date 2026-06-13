import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DecisionStore } from "./decision-store.js";

describe("DecisionStore", () => {
  it("round-trips a decision node and graph queries", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-store-"));
    const store = new DecisionStore(join(dir, "state.sqlite"));
    const mission = store.createMission("Add auth");
    const first = store.addDecision({
      missionId: mission.id,
      question: "Auth strategy?",
      options: [{ id: "jwt", label: "JWT" }],
      choice: "jwt",
      rationale: "Fixture decision",
      citedEvidence: ["docs/adr/0005-grounded-decisioning-evidence-vs-verdict.md"],
      citedSurfaces: [{ id: "auth", kind: "auth-security", source: "cited" }],
      dependsOn: [],
      tier: "critical",
      ruleFired: "surface:auth-security",
      status: "proposed"
    });
    const second = store.addDecision({
      missionId: mission.id,
      question: "Session persistence?",
      options: [{ id: "db", label: "DB" }],
      choice: "db",
      rationale: "Depends on auth strategy",
      citedEvidence: [],
      citedSurfaces: [],
      dependsOn: [first.id],
      tier: "low",
      ruleFired: "default",
      status: "proposed"
    });

    expect(store.getDecision(first.id)?.question).toBe("Auth strategy?");
    expect(store.transitiveDependents(first.id)).toEqual([second.id]);
    expect(store.invalidationSet(first.id)).toEqual([first.id, second.id]);
    expect(store.reusedSet(first.id, mission.id)).toEqual([]);
    expect(store.topoOrder(mission.id)).toEqual([first.id, second.id]);
    store.markReviewed(first.id);
    expect(store.getDecision(first.id)?.reviewed).toBe(true);
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
