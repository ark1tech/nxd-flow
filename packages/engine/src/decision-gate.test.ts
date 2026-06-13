import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BlastRadiusClassifier } from "./blast-radius.js";
import { DecisionGate, type Auditor } from "./decision-gate.js";
import { DecisionStore } from "./decision-store.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { ProfileStore } from "./profile-store.js";

describe("DecisionGate", () => {
  it("escalates high-blast uncovered flagged decisions", async () => {
    const ctx = setup();
    const mission = ctx.store.createMission("Add auth");
    const decision = ctx.store.addDecision({
      missionId: mission.id,
      question: "Choose auth strategy",
      options: [{ id: "jwt", label: "JWT" }],
      choice: "jwt",
      rationale: "Unknown auth boundary",
      citedEvidence: [],
      citedSurfaces: [{ id: "auth", kind: "auth-security", source: "cited" }],
      dependsOn: [],
      tier: "low",
      ruleFired: "unclassified",
      status: "proposed"
    });
    const gate = new DecisionGate(ctx.classifier, ctx.profile, ctx.knowledge, ctx.store, flaggedAuditor);
    const result = await gate.evaluate(decision);
    expect(result.verdict).toBe("escalate");
    expect(result.evidence.auditor).toBe("flagged");
    ctx.cleanup();
  });

  it("decides high-blast covered decisions with an ok auditor", async () => {
    const ctx = setup(["auth decisions should prefer JWT in the fixture"]);
    const mission = ctx.store.createMission("Add auth");
    const decision = ctx.store.addDecision({
      missionId: mission.id,
      question: "Choose auth strategy",
      options: [{ id: "jwt", label: "JWT" }],
      choice: "jwt",
      rationale: "Use JWT for auth decisions",
      citedEvidence: [],
      citedSurfaces: [{ id: "auth", kind: "auth-security", source: "cited" }],
      dependsOn: [],
      tier: "low",
      ruleFired: "unclassified",
      status: "proposed"
    });
    const gate = new DecisionGate(ctx.classifier, ctx.profile, ctx.knowledge, ctx.store, okAuditor);
    const result = await gate.evaluate(decision);
    expect(result.verdict).toBe("decide");
    expect(result.evidence.coverage).toBe("covered");
    ctx.cleanup();
  });
});

const okAuditor: Auditor = { audit: async () => ({ status: "ok", reason: "covered" }) };
const flaggedAuditor: Auditor = { audit: async () => ({ status: "flagged", reason: "missing evidence" }) };

function setup(profileRules: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-gate-"));
  const profilePath = join(dir, "PROFILE.md");
  writeFileSync(profilePath, ["# Pilot Profile", "", "## Rules", "", ...profileRules.map((rule) => `- ${rule}`), ""].join("\n"));
  return {
    store: new DecisionStore(join(dir, "state.sqlite")),
    profile: new ProfileStore(profilePath, join(dir, "history")),
    knowledge: new KnowledgeStore(join(dir, "knowledge.md"), dir),
    classifier: new BlastRadiusClassifier({
      tiers: {
        schema: "high",
        "public-api": "high",
        "auth-security": "critical",
        money: "critical",
        "data-lifecycle": "critical",
        "foundational-dependency": "high",
        "cross-cutting": "medium",
        project: "low"
      }
    }),
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}
