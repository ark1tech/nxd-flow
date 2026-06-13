import { describe, expect, it } from "vitest";
import { BlastRadiusClassifier } from "./blast-radius.js";

describe("BlastRadiusClassifier", () => {
  const classifier = new BlastRadiusClassifier({
    tiers: {
      schema: "high",
      "public-api": "high",
      "auth-security": "critical",
      money: "critical",
      "data-lifecycle": "critical",
      "foundational-dependency": "high",
      "cross-cutting": "medium",
      project: "low"
    },
    overrides: [{ match: "pricing/**", tier: "critical", rule: "override:pricing" }]
  });

  it("classifies over cited and derived surfaces with rule evidence", () => {
    const result = classifier.classify([
      { id: "project", kind: "project", source: "cited" },
      { id: "auth", kind: "auth-security", source: "derived", locator: "src/auth.ts" }
    ]);

    expect(result).toEqual({ tier: "critical", ruleFired: "surface:auth-security", consequential: true });
  });

  it("applies project overrides", () => {
    const result = classifier.classify([{ id: "pricing", kind: "project", source: "derived", locator: "pricing/rules.ts" }]);
    expect(result.tier).toBe("critical");
    expect(result.ruleFired).toBe("override:pricing");
  });
});
