import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProfileStore } from "./profile-store.js";

describe("ProfileStore", () => {
  it("seeds onboarding answers and returns grep-citable coverage", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-profile-"));
    const store = new ProfileStore(join(dir, "PROFILE.md"), join(dir, "history"));
    store.seedFromOnboarding(["Prefer JWT for auth in the fixture", "Avoid magic abstractions"]);

    expect(store.effectiveRules()).toHaveLength(2);
    expect(store.coverageFor({ question: "Auth strategy?", choice: "jwt", rationale: "JWT keeps fixture auth simple" })).toEqual({
      status: "covered",
      evidence: ["Prefer JWT for auth in the fixture"]
    });
    expect(store.coverageFor({ question: "Billing?", choice: "stripe", rationale: "Payments" }).status).toBe("uncovered");
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies scoped deltas but ignores once-only corrections", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-profile-"));
    const store = new ProfileStore(join(dir, "PROFILE.md"), join(dir, "history"));

    expect(store.proposeDelta("Use sessions only for admin tools", "once").applied).toBe(false);
    expect(store.proposeDelta("Use sessions only for admin tools", "context").applied).toBe(true);
    expect(store.effectiveRules()[0].text).toContain("sessions");
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports training wheels while the profile has fewer than two rules", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-profile-"));
    const store = new ProfileStore(join(dir, "PROFILE.md"), join(dir, "history"));

    expect(store.trainingWheels()).toEqual({ enabled: true, ruleCount: 0, requiredRules: 2 });
    store.seedFromOnboarding(["Prefer JWT for auth in the fixture", "Avoid magic abstractions"]);
    expect(store.trainingWheels()).toEqual({ enabled: false, ruleCount: 2, requiredRules: 2 });
    rmSync(dir, { recursive: true, force: true });
  });

  it("hardens repeated provisional rules and surfaces conflicts", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-profile-"));
    const store = new ProfileStore(join(dir, "PROFILE.md"), join(dir, "history"));

    const first = store.proposeDelta("Prefer JWT for auth strategy", "global");
    const second = store.proposeDelta("Prefer JWT for auth strategy", "global");
    const conflict = store.proposeDelta("Prefer sessions for auth strategy", "global");

    expect(first.rule?.provisional).toBe(true);
    expect(second.rule?.provisional).toBe(false);
    expect(second.rule?.weight).toBeGreaterThan(first.rule!.weight);
    expect(conflict.conflicts?.[0]).toContain("Prefer JWT for auth strategy");
    expect(store.effectiveRules().find((rule) => rule.text.includes("JWT"))?.weight).toBeLessThan(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("exposes decayStale as a no-op baseline hook", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-profile-"));
    const store = new ProfileStore(join(dir, "PROFILE.md"), join(dir, "history"));
    store.seedFromOnboarding(["Prefer JWT for auth in the fixture"]);

    expect(store.decayStale()).toEqual({ decayed: 0 });
    rmSync(dir, { recursive: true, force: true });
  });
});
