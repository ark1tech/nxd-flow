import { createHash } from "node:crypto";
import type { DecisionNode, GateResult } from "@autopilot/shared";
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
    const auditNeeded = decision.tier === "medium" || decision.tier === "high" || decision.tier === "critical";
    const cacheKey = `audit:${hash(`${decision.question}:${decision.choice}:${decision.citedEvidence.join("|")}`)}`;
    const cached = this.store.cacheGet<{ status: "ok" | "flagged"; reason?: string }>(cacheKey);
    const auditor = auditNeeded ? cached ?? (await this.auditor.audit(decision)) : { status: "ok" as const };
    if (auditNeeded && !cached) this.store.cacheSet(cacheKey, auditor);
    const budgetExhausted = auditNeeded && this.store.listEvents().filter((event) => event.type === "gate.decided").length > this.budget;
    const shouldEscalate =
      budgetExhausted ||
      ((decision.tier === "high" || decision.tier === "critical") && (coverage === "uncovered" || auditor.status === "flagged"));

    const result: GateResult = {
      verdict: shouldEscalate ? "escalate" : "decide",
      evidence: {
        tier: decision.tier,
        ruleFired: decision.ruleFired,
        coverage,
        coverageEvidence,
        auditor: auditNeeded ? auditor.status : "skipped",
        auditorReason: auditor.reason,
        budgetExhausted
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

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
