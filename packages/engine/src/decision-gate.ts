import { createHash } from "node:crypto";
import type { DecisionNode, GateResult } from "@autopilot/shared";
import type { AgentRunner } from "./agent-runner.js";
import { BlastRadiusClassifier } from "./blast-radius.js";
import type { DecisionStore } from "./decision-store.js";
import type { KnowledgeStore } from "./knowledge-store.js";
import type { ProfileStore } from "./profile-store.js";

export interface Auditor {
  audit(decision: DecisionNode): Promise<{ status: "ok" | "flagged"; reason?: string }>;
}

export class DecisionGate {
  constructor(
    private readonly classifier: BlastRadiusClassifier,
    private readonly profile: ProfileStore,
    private readonly knowledge: KnowledgeStore,
    private readonly store: DecisionStore,
    private readonly auditor: Auditor,
    private readonly budget = 100
  ) {}

  async evaluate(decision: DecisionNode): Promise<GateResult> {
    const classification = this.classifier.classify(decision.citedSurfaces);
    decision.tier = classification.tier;
    decision.ruleFired = classification.ruleFired;
    this.store.updateDecision(decision);

    const profileCoverage = this.profile.coverageFor(decision);
    const knowledgeCoverage = this.knowledge.coverageFor(`${decision.question} ${decision.rationale} ${decision.choice}`);
    const coverageEvidence = [...profileCoverage.evidence, ...knowledgeCoverage.evidence];
    const coverage = coverageEvidence.length > 0 ? "covered" : "uncovered";
    const trainingWheels = this.profile.trainingWheels();
    const auditNeeded = decision.tier === "medium" || decision.tier === "high" || decision.tier === "critical";
    const cacheKey = `audit:${hash(`${decision.question}:${decision.choice}:${decision.citedEvidence.join("|")}`)}`;
    const cached = this.store.cacheGet<{ status: "ok" | "flagged"; reason?: string }>(cacheKey);
    const auditor = auditNeeded ? cached ?? (await this.auditor.audit(decision)) : { status: "ok" as const };
    if (auditNeeded && !cached) this.store.cacheSet(cacheKey, auditor);
    const budgetExhausted = auditNeeded && this.store.listEvents().filter((event) => event.type === "gate.decided").length > this.budget;
    const shouldEscalate =
      budgetExhausted ||
      ((decision.tier === "high" || decision.tier === "critical") && (coverage === "uncovered" || auditor.status === "flagged")) ||
      (trainingWheels.enabled && decision.tier === "medium" && coverage === "uncovered");

    const result: GateResult = {
      verdict: shouldEscalate ? "escalate" : "decide",
      evidence: {
        tier: decision.tier,
        ruleFired: decision.ruleFired,
        coverage,
        coverageEvidence,
        auditor: auditNeeded ? auditor.status : "skipped",
        auditorReason: auditor.reason,
        budgetExhausted,
        trainingWheels: trainingWheels.enabled
      }
    };
    this.store.addEvent(shouldEscalate ? "gate.escalated" : "gate.decided", decision.missionId, { decisionId: decision.id, result });
    return result;
  }
}

export class MockAuditor implements Auditor {
  async audit(decision: DecisionNode): Promise<{ status: "ok" | "flagged"; reason?: string }> {
    if (/unsafe|unknown|secret/i.test(`${decision.question} ${decision.rationale}`)) {
      return { status: "flagged", reason: "Mock auditor found an unsafe or unknown decision." };
    }
    return { status: "ok", reason: "Mock auditor found the decision defensible for this slice." };
  }
}

export class SdkAuditor implements Auditor {
  constructor(
    private readonly runner: Pick<AgentRunner, "run">,
    private readonly cwd: string,
    private readonly live: boolean
  ) {}

  async audit(decision: DecisionNode): Promise<{ status: "ok" | "flagged"; reason?: string }> {
    const result = await this.runner.run({
      prompt: auditorPrompt(decision),
      cwd: this.cwd,
      role: "auditor",
      missionId: decision.missionId,
      stepName: `audit-${decision.id}`,
      live: this.live
    });
    if (result.status === "error") return { status: "flagged", reason: result.text };
    return parseAudit(result.text) ?? { status: "flagged", reason: "Auditor did not return a parseable critique." };
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function auditorPrompt(decision: DecisionNode): string {
  return [
    "You are the Autopilot auditor. Critique this proposed Autopilot decision.",
    "Return exactly one JSON block with {\"status\":\"ok\"|\"flagged\",\"reason\":\"...\"}.",
    "Judge defensibility plus whether surfaces, coverage, and dependencies appear correctly cited.",
    "",
    JSON.stringify(decision, null, 2)
  ].join("\n");
}

function parseAudit(text: string): { status: "ok" | "flagged"; reason?: string } | undefined {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]) as { status?: string; reason?: string };
    if (parsed.status !== "ok" && parsed.status !== "flagged") return undefined;
    return { status: parsed.status, reason: parsed.reason };
  } catch {
    return undefined;
  }
}
