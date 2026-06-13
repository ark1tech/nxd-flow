import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAutopilot } from "./index.js";

describe("onboarding grill", () => {
  it("generates fallback questions and seeds PROFILE.md from answers", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-onboarding-"));
    const { store, engine } = createAutopilot(dir);

    const grill = engine.generateOnboardingQuestions("Add authentication");
    expect(grill.questions.length).toBeGreaterThanOrEqual(3);
    expect(grill.trainingWheels.ruleCount).toBeGreaterThanOrEqual(0);

    const profile = engine.submitOnboardingAnswers([
      "Prefer JWT for auth in the fixture",
      "Keep route handlers inside Fastify",
      "Avoid new databases unless required"
    ]);

    expect(profile.trainingWheels.enabled).toBe(false);
    expect(profile.rules.map((rule) => rule.text)).toContain("Prefer JWT for auth in the fixture");
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
