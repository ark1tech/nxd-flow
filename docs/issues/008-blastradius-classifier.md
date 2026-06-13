# ISSUE-008 — `BlastRadiusClassifier` + policy file (the trust anchor)

- Status: ready-for-agent
- Depends on: 002, 004
- Modules: `BlastRadiusClassifier` (pure-logic) + MCP wiring
- Refs: ADR-0005, ADR-0004

## Context
The deterministic core of grounding: the Pilot cites surfaces; this module renders the tier. Also doubles
as the "is this consequential?" floor (ADR-0004).

## Scope / acceptance criteria
- `.autopilot/policy/blast-radius.yml` schema + sane defaults: DB schema/migrations, public API/exported
  contracts, auth/security, money/billing, data lifecycle (PII/deletion/prod data), foundational
  dependency, cross-cutting (> module-count threshold).
- `classify(citedSurfaces, files, policy) → { tier, ruleFired }` — pure & deterministic.
- `isConsequential(...)` floor = touches any surface OR foundational dependency; Pilot may flag additional
  but never demote a floor-caught choice.
- Per-project overrides (e.g. mark `pricing/**` critical) honored; every classification records `ruleFired`.
- MCP: classification runs automatically when `cite_surfaces` is called; node stores tier + ruleFired.

## Tests (hard — pure logic, highest coverage)
- Each surface → expected tier; foundational dependency → high even with few files.
- Overrides change the outcome; `ruleFired` is accurate; unknown surfaces default safely.
- `isConsequential` floor cannot be demoted by the Pilot.

## Out of scope
- Using the tier to escalate or budget verification (ISSUE-009).
