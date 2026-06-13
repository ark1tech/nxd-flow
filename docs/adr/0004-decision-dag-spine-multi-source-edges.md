# ADR-0004 — The Decision DAG as the spine, with multi-source edges

- Status: Accepted
- Date: 2026-06-13
- Related: ADR-0003, ADR-0005, PRD `docs/prd/autopilot-mvp-v1.md`

## Context

Autopilot's two headline features — **pivoting a decision and watching the loop re-react** and (later)
**serial-vs-parallel scheduling** — both need to know the dependency relationships between consequential
decisions. Branching is only correct if dependency edges are complete: an under-cited edge means a pivot
silently fails to re-run something it should, which is invisible and corrupts the whole feature.

Relying on the Pilot to self-declare every dependency is fragile — the model will forget some.

## Decision

Make a **Decision DAG of consequential nodes** the single core data structure. One graph powers
pivot-invalidation now and scheduling later.

- A choice is **auto-consequential** if it touches any blast-radius surface or introduces a foundational
  dependency (deterministic floor, see ADR-0005); the Pilot may additionally flag interesting
  low-blast-radius choices but can never demote a floor-caught one. Micro-choices stay invisible.
- Node shape: `{ question, options, choice, rationale, citedEvidence, citedSurfaces, dependsOn[] }`.
- **Edges are multi-source** (defense in depth):
  1. *Declared* — Pilot cites prior nodes/profile/files at decision time. A hint, not the source of truth.
  2. *Derived* — computed from the real diff/file-overlap (ground truth: if M's commit touches files N's
     commit produced, `N→M` exists regardless of declaration). v1 uses git-diff file-overlap; an import
     graph is a later enhancement (see ADR/PRD scope).
  3. *Checked* — the auditor's completeness pass on high-tier nodes cross-checks declared vs. reality
     (folded into the audit call — see ADR-0005).
- **Reuse means "do not re-run."** LLM code generation is **non-deterministic**, so re-running the Pilot on
  the "same" decision would *not* reproduce the same code. Therefore a pivot never regenerates the reused
  set: it **commit-replays** those decisions' original commits into the new worktree, and re-runs *only*
  the `invalidationSet` (the changed node's transitive dependents) with fresh agent runs. "Reused =
  byte-identical" is honestly true because reused files are the original commits.
- **Conservative pivots:** when a dependency is uncertain, include it in the `invalidationSet` (re-run it).
  Over-inclusion costs compute, not correctness — re-running is always safe; *reusing* something that
  should have changed is the only dangerous direction, so the system biases toward re-running.
- **Self-correction:** after a pivot, diff produced artifacts vs. original; a supposedly-reused artifact
  that *would* have changed reveals a missing edge → add it and flag (the DAG sharpens over time).

## Consequences

- Positive: branching is correct-by-construction and self-healing; reuse is cheap and lineage-clean
  (git commit-replay); the same structure is reused for scheduling, avoiding a second model of dependencies.
- Negative / watch-outs: commit-replay assumes one Decision Node ↔ one commit (guaranteed by the stepped
  loop, ADR-0006); replaying a reused commit could in rare cases conflict with a re-run dependent's edits —
  by definition reused nodes are independent of the pivot, so conflicts indicate a missing edge and are
  caught by self-correction. v1 derived edges are diff-overlap only (coarser than an import graph; the
  conservative bias absorbs the imprecision).
