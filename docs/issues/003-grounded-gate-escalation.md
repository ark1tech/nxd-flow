# ISSUE-003 (S2b) — Grounded gate: high-blast + uncovered/flagged pauses the loop

- Type: HITL
- Triage: ready-for-agent
- User stories: 10, 11, 12, 13, 14
- Refs: ADR-0005 (DecisionGate, auditor), ADR-0006 (stepped loop), `docs/GLOSSARY.md`

## Context (read first)
The orchestrator owns the loop and gates **between** steps (ADR-0006): a bounded run proposes a decision,
the engine evaluates it, and only proceeds if it clears. This is how the human "stays the engineer" without
babysitting — the loop runs autonomously but **declines to proceed past** a load-bearing decision it isn't
sure about, asking the human instead. The escalation trigger must be evidence-based, not vibes.

## What to build
Compose `DecisionGate.evaluate(decision) → {decide | escalate, evidence}` from: the classifier (ISSUE-002);
a coverage check (`ProfileStore.coverageFor` — for now an empty profile means "uncovered"); and an
**auditor** — a *separate* SDK agent (different model via `AgentRunner` role) that **critiques** the
proposed decision ("is it defensible; are its surfaces/coverage/dependencies correct? → {ok|flag}+reason"),
NOT a re-deriver. `EscalationPolicy`: escalate iff `tier ∈ {high,critical} AND (uncovered OR auditor flags)`.
Verification is risk-proportional (low→no audit, medium→cheap, high/critical→full), verdicts cached by
`hash(question + cited evidence)`, with a per-Mission budget that **escalates when exhausted** (never
silently skips). On escalate, the `LoopEngine` does not launch the next step; the dashboard shows the
question + evidence and the human's answer resumes the loop (`Agent.resume`).

## Acceptance criteria
- [ ] `DecisionGate.evaluate` returns `decide`/`escalate` per the policy, with the supporting evidence.
- [ ] The auditor critiques (does not re-derive); an `ok` audit on a high-tier covered decision → `decide`;
      a `flag` (or uncovered) on high-tier → `escalate`.
- [ ] On `escalate`, the next step is NOT launched until the human answers; the answer resumes the loop.
- [ ] Risk-proportional intensity; verdict cache hit avoids a re-audit; budget exhaustion → escalate, not skip.
- [ ] Dashboard renders the escalation (question + evidence) and an answer control.
- [ ] Unit tests: `EscalationPolicy` truth table (tier × coverage × auditor-flag); budget intensity/cache/
      exhaustion; integration test with a mocked auditor (ok vs flag).

## Blocked by
- ISSUE-002 (S2a).
