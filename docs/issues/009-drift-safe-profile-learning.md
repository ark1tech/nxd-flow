# ISSUE-009 (S8) — Drift-safe profile learning from overrides

- Type: HITL
- Triage: ready-for-agent
- User stories: 28, 29, 30, 31
- Refs: ADR-0005 (profile learning), `docs/GLOSSARY.md`

## Context (read first)
Branch-overrides (ISSUE-007) are the Pilot's teaching signal — but a one-off correction must never become
permanent law, and the profile must never mutate silently (the human stays its author). This closes the
loop: overriding a decision proposes a *scoped*, *provisional* profile change the human consents to.

## What to build
Extend `ProfileStore` so an override produces a **proposed delta** and prompts for **scope**: `once` (learn
nothing) / `context` (scoped rule) / `global` (general rule). No silent edits to `PROFILE.md`. Learned rules
start **provisional + low-weight**; **harden on corroboration** (repeated consistent overrides), **weaken on
conflict**, **decay when stale** (resurface for re-confirmation). `detectConflicts(newRule)` surfaces
"contradicts X from <date> — replace / scope / keep both?". Profile stays versioned/diffable/revertible with
each change attributed to the override that caused it.

## Acceptance criteria
- [ ] Overriding a decision asks for scope; `once` changes nothing, `context` scopes, `global` generalizes.
- [ ] No write to `PROFILE.md` happens without explicit scope consent.
- [ ] Rules harden only after corroboration; a conflicting override weakens/retires a rule; stale rules decay.
- [ ] Conflicts are surfaced with the prior rule + date; revert restores prior profile state.
- [ ] Unit tests (drift logic — highest coverage): scope handling, corroboration/decay, conflict detection,
      revert.

## Blocked by
- ISSUE-007 (S7), ISSUE-004 (S4).
