import { describe, expect, it } from "vitest";
import type { DecisionNode } from "@autopilot/shared";
import { calculateDebt } from "./debt-meter.js";

describe("DebtMeter", () => {
  it("weights unreviewed decisions by tier", () => {
    const nodes = [
      node("a", "low", false),
      node("b", "critical", false),
      node("c", "high", true)
    ];
    expect(calculateDebt(nodes, 10)).toEqual({
      score: 14,
      ceilingExceeded: true,
      unreviewed: [
        { id: "a", weight: 1 },
        { id: "b", weight: 13 }
      ]
    });
  });
});

function node(id: string, tier: DecisionNode["tier"], reviewed: boolean): DecisionNode {
  return {
    id,
    missionId: "m",
    question: id,
    options: [],
    choice: "a",
    rationale: "",
    citedEvidence: [],
    citedSurfaces: [],
    dependsOn: [],
    tier,
    ruleFired: "",
    status: "proposed",
    reviewed,
    createdAt: "",
    updatedAt: ""
  };
}
