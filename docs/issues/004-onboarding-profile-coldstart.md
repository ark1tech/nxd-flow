# ISSUE-004 (S4) — Onboarding grill → PROFILE.md + cold-start training wheels

- Type: HITL
- Triage: ready-for-agent
- User stories: 2, 3, 4, 32
- Refs: ADR-0005 (profile, coverage), `docs/GLOSSARY.md`

## Context (read first)
The Pilot decides "as the user," so it needs a model of the user's taste. The human is grilled **once** up
front to build a persisted `PROFILE.md`; the gate's coverage check (ISSUE-003) reads it. Because the first
Mission has a thin profile, escalation must be more conservative early and relax as coverage grows
("training wheels"), so v1 isn't annoying but also isn't reckless.

## What to build
An onboarding flow that grills the human and writes a structured, versioned `PROFILE.md`
(`ProfileStore.seedFromOnboarding`), plus best-effort `seedFromRepoSignals` (extract hints from
`AGENTS.md`/`README`/`CONTEXT` if present). Implement `ProfileStore.coverageFor(decision)` returning
grep-citable evidence or "uncovered". Make `EscalationPolicy` **coverage-aware**: while overall profile
coverage is low, bias toward escalation, relaxing as coverage rises; expose the current "training-wheels"
level to the dashboard.

## Acceptance criteria
- [ ] Onboarding produces a parseable, versioned `PROFILE.md` (history entry per change).
- [ ] `coverageFor` returns correct citations for covered decisions and "uncovered" otherwise.
- [ ] `seedFromRepoSignals` populates initial hints when repo signal files exist (no-op otherwise).
- [ ] With an empty profile a borderline decision escalates; after the profile covers it, the same decision
      does not.
- [ ] The training-wheels level is reported to the dashboard and decreases as coverage rises.
- [ ] Unit tests: coverage citations; onboarding round-trip; coverage-aware conservatism.

## Blocked by
- ISSUE-002 (S2a). (Integrates with the gate from ISSUE-003 but can be built in parallel against an
  empty-profile stub.)
