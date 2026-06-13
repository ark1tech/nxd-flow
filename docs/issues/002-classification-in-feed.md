# ISSUE-002 (S2a) — Decisions are classified (blast-radius) from cited + derived surfaces

- Type: AFK
- Triage: ready-for-agent
- User stories: 6, 7, 8, 9
- Refs: ADR-0004 (multi-source), ADR-0005 (grounded decisioning §1), `docs/GLOSSARY.md`

## Context (read first)
Trust in Autopilot rests on a **grounded** notion of how risky a decision is, computed by a deterministic
rule — never the model's self-rated confidence (ADR-0005). A decision's risk (**blast-radius tier**) is a
function of the **surfaces** it touches, and surfaces are **multi-source**: what the Pilot *cites* plus what
is *derived from the actual diff* (so the Pilot under-citing can't silently hide risk). This slice makes a
proposed decision get classified and shows its tier + which rule fired in the feed.

## What to build
Extend the proposal path so each Decision Node carries surfaces from two sources: `cite_surfaces` (Pilot
hint) and a derived pass over the decision's changed files (v1: the files touched in that step's diff). A
deterministic `BlastRadiusClassifier` reads `.autopilot/policy/blast-radius.yml` (ship sane defaults:
schema/migrations, public API, auth/security, money/billing, data lifecycle, foundational dependency,
cross-cutting) and assigns `{low|medium|high|critical}` over the **union** of surfaces, recording
`ruleFired`. Also expose `isConsequential(surfaces)` (the consequential floor) so the Pilot can't demote a
floor-caught decision. The feed shows the tier + ruleFired per decision.

## Acceptance criteria
- [ ] `BlastRadiusClassifier.classify(surfaces, policy) → {tier, ruleFired}` is pure and deterministic.
- [ ] Surfaces are the **union** of cited + diff-derived; a decision whose Pilot omitted a surface still gets
      it from the derived pass.
- [ ] Default `blast-radius.yml` ships; per-project overrides (e.g. a glob → critical) take effect.
- [ ] `isConsequential` returns true when any blast-radius surface or foundational dependency is touched.
- [ ] Each decision in the feed displays its tier and the rule that fired.
- [ ] Unit tests (trust anchor — highest coverage): every surface→tier mapping; foundational dependency →
      high with few files; override applies; classification over the cited∪derived union; `isConsequential`
      truth table.

## Blocked by
- ISSUE-001 (S1).
