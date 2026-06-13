import { describe, expect, it } from "vitest";
import type { DecisionNode } from "@autopilot/shared";
import type { AgentRunRequest, AgentRunResult } from "./agent-runner.js";
import { SdkAuditor } from "./decision-gate.js";

describe("SdkAuditor", () => {
  it("runs the auditor agent and parses a flagged critique", async () => {
    const requests: AgentRunRequest[] = [];
    const runner = {
      async run(request: AgentRunRequest): Promise<AgentRunResult> {
        requests.push(request);
        return { status: "finished", text: '```json\n{"status":"flagged","reason":"Surface is under-cited."}\n```' };
      }
    };
    const auditor = new SdkAuditor(runner, "/repo/scratch", true);

    const result = await auditor.audit(decision());

    expect(result).toEqual({ status: "flagged", reason: "Surface is under-cited." });
    expect(requests[0]).toMatchObject({ role: "auditor", cwd: "/repo/scratch", live: true });
    expect(requests[0].prompt).toContain("Critique this proposed Autopilot decision");
  });

  it("fails closed when the auditor response cannot be parsed", async () => {
    const runner = {
      async run(): Promise<AgentRunResult> {
        return { status: "finished", text: "not json" };
      }
    };
    const auditor = new SdkAuditor(runner, "/repo/scratch", true);

    await expect(auditor.audit(decision())).resolves.toEqual({
      status: "flagged",
      reason: "Auditor did not return a parseable critique."
    });
  });
});

function decision(): DecisionNode {
  return {
    id: "dec_1",
    missionId: "mis_1",
    question: "Which auth strategy?",
    options: [{ id: "jwt", label: "JWT" }],
    choice: "jwt",
    rationale: "Stateless fixture.",
    citedEvidence: ["docs/prd/autopilot-mvp-v1.md"],
    citedSurfaces: [{ id: "auth", kind: "auth-security", source: "cited" }],
    dependsOn: [],
    tier: "critical",
    ruleFired: "surface:auth-security",
    status: "proposed",
    reviewed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
