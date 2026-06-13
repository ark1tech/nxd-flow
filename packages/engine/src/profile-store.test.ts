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
});
