# ADR-0006 — The orchestrator owns the loop (stepped runs, gate between steps)

- Status: Accepted
- Date: 2026-06-13
- Related: ADR-0001, ADR-0005, PRD `docs/prd/autopilot-mvp-v1.md`
- Supersedes the "the loop pauses and resumes on answer" phrasing in earlier drafts.

## Context

The grounded mechanisms (blast-radius classification, coverage, audit, escalation) must run **before** a
consequential decision is built upon — otherwise escalating "after the fact" is too late, and the gate is
un-enforceable. An earlier draft implied a single long Pilot run that makes many decisions and "pauses
mid-run" for the human. That does not map to how agent runs work: a `agent.send` run is autonomous; you
can `cancel` it, but you cannot cleanly suspend it mid-reasoning, inject a human answer, and continue the
same run. And inside such a run the agent has already proceeded past the decision.

This is fundamentally a question of **who owns loop granularity** — the agent (one long run) or the
orchestrator (many bounded runs).

## Decision

**The orchestrator (`LoopEngine`) owns the loop.** Execution is *stepped*:

1. Each bounded agent run ends by **proposing** its consequential decision(s) via MCP
   (`propose_decision` + `cite_surfaces`/`cite_dependencies`) — it does not silently build on them.
2. Between runs, the orchestrator calls `DecisionGate.evaluate(decision)` (classify → coverage → audit →
   escalation; see ADR-0005).
3. Only after a decision **clears the gate** does the orchestrator launch the next step
   (`Agent.resume` with the updated context). **Escalation = "don't launch the next step until the human
   answers"** — no mid-run suspension is required.

Consequences for related mechanisms:
- Classification/audit/escalation are enforceable at a real boundary (this makes ADR-0005 implementable).
- One Decision Node ↔ one bounded step ↔ (when it produces code) one git commit/Checkpoint — which is
  exactly what commit-replay pivots need (ADR-0004).
- Each step is fed a **working-memory** context pack assembled by the engine from canonical state (the
  memory *view*, ADR-0007) rather than relying on the agent's own thread to carry context across `resume`.

## Consequences

- Positive: every grounded gate is enforceable before downstream work depends on a decision; the loop is
  literally "you write the loop"; resumable across process restarts via `Agent.resume` (re-passing inline
  MCP servers, per ADR-0001).
- Negative / watch-outs: more, shorter runs ⇒ more `resume` round-trips and prompt-context re-priming;
  the step prompt must reliably get the Pilot to *stop and propose* rather than barrel ahead (enforced by
  instruction + by treating an un-proposed decision discovered in the diff as a gate failure). Step
  granularity must be coarse enough to be practical and fine enough to gate load-bearing decisions — tune
  against the consequential floor (a step boundary is required at least whenever a blast-radius surface is
  touched).
