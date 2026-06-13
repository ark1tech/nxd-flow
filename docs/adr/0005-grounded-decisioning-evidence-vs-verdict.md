# ADR-0005 — Grounded decisioning: LLM cites evidence, deterministic rule or human renders the verdict

- Status: Accepted
- Date: 2026-06-13
- Related: ADR-0004, PRD `docs/prd/autopilot-mvp-v1.md`

## Context

Autopilot's trust depends on it never being *falsely* optimistic or anxious. A self-reported confidence
score ("I'm 70% sure") is itself a hallucination and cannot anchor when the loop pauses, what it verifies,
what it logs, or how it learns. Four mechanisms are at risk of leaning on ungrounded model judgment:
escalation, blast-radius classification, verification spend, and profile learning.

## Decision

Adopt one **governing principle** across the engine: **the LLM produces grounded, citable evidence; a
deterministic rule or explicit human consent produces the verdict.** Applications:

1. **Blast-radius (multi-source surfaces)** — Surfaces are **not** trusted from the Pilot alone (that would
   be a single-source, "silently wrong" hole). They are the union of *cited* surfaces (Pilot hint) **and
   *derived* surfaces computed from the actual diff/changed files** (ground truth) — the same defense-in-
   depth as edges (ADR-0004). A deterministic `BlastRadiusClassifier` maps surfaces → tier
   `{low, medium, high, critical}` and records which rule fired. Policy in
   `.autopilot/policy/blast-radius.yml`: sane defaults, seeded by the onboarding grill, per-project
   overridable. Surfaces include DB schema/migrations, public API/exported contracts, auth/security,
   money/billing, data lifecycle (PII/deletion/prod data), introducing a foundational dependency, and
   cross-cutting (> module threshold). It proxies *reversibility cost*.
2. **Escalation** — `EscalationPolicy`: escalate iff `tier ∈ {high, critical} AND (uncovered-by-profile OR
   auditor-flags)`. Coverage is grep-citable from PROFILE/ADRs/glossary **and re-validated
   Project-knowledge** (ADR-0007: a knowledge fact only counts as coverage for a medium+ decision if its
   provenance still holds against the current repo; stale ⇒ doesn't count ⇒ degrade toward escalate). Every
   escalation shows evidence.
   Default posture: decide-and-continue; the human can branch anything later. Escalation is enforced *at
   the step boundary* — the orchestrator simply does not launch the next step until answered (ADR-0006);
   no mid-run suspension.
3. **Verification (auditor, not re-deriver)** — a *separate* auditor agent (different model) **critiques**
   the proposed decision rather than independently re-deriving it: *"given this decision + cited evidence,
   is it defensible, and are its surfaces/coverage/dependencies correctly assessed? → {ok | flag} + reason."*
   Re-deriving-and-diffing was rejected: two stochastic agents routinely pick different-but-valid options,
   producing false disagreement. The audit also performs the **edge/surface completeness check** (the
   "checked" pass from ADR-0004) in the same call. Intensity is **risk-proportional**: low → no audit;
   medium → cheap coverage-only audit; high/critical → full audit. Verdicts cached by
   `hash(normalized question + cited evidence)`; reviewed nodes skipped. A per-Mission budget **escalates
   when exhausted** — never silently skips a critical audit.
4. **Profile learning** — an override never silently edits `PROFILE.md`; it proposes a delta and asks for
   **scope** (once / context / global). Rules start provisional + weighted, harden on corroboration, weaken
   on conflict, decay when stale; conflicts surfaced; profile versioned/diffable/revertible.

**Composition (`DecisionGate`).** These are not four things the orchestrator wires together by hand; they
compose into one seam: `DecisionGate.evaluate(decision) → { decide | escalate, evidence }`
(classify → coverage → audit → escalation). The inner pieces stay pure and independently unit-testable, but
the `LoopEngine` sees a single call per proposed decision (ADR-0006).

**State.** Debt, review-state, and the verdict/budget cache are **not** separate stores — they are computed
or cached over the one transactional Decision Store (ADR-0003); `DebtMeter` is a pure scoring function, not
a stateful module.

**Execution sandbox.** Code-producing decisions are verified and committed in an isolated Mission scratch
repo, so grounded verdicts, checkpoints, and pivot replay are real without mutating the Autopilot tool repo
(ADR-0008).

**Safe-degradation invariant:** every mechanism fails toward "ask the human" or "re-run too much," never
toward "silently wrong."

## Consequences

- Positive: trust is auditable (you can see the rule that fired and the evidence cited); behavior is
  consistent and tunable rather than vibe-based; matches the "stay the engineer" thesis.
- Negative / watch-outs: blast-radius policy quality is the trust anchor — bad rules turn escalation into
  noise, so it needs empirical tuning (log which rule fired); the auditor adds one extra (cheap) agent call
  per medium+ decision (mitigated by tiering, caching, and skipping reviewed nodes); the stepped loop's
  step prompt must reliably make the Pilot stop-and-propose so the gate actually sees each decision
  (ADR-0006).
