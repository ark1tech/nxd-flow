# ADR-0003 — Hybrid state: git-tracked markdown memory + SQLite index

- Status: Accepted
- Date: 2026-06-13
- Related: PRD `docs/prd/autopilot-mvp-v1.md`

## Context

Autopilot has two kinds of state: (1) durable, human-readable "memory" that onboarding and comprehension
depend on (Profile, glossary, ADRs, per-decision rationale, lessons) — Addy Osmani's "the repo remembers,
the model forgets"; and (2) fast operational/graph state (DAG nodes/edges, debt scores, review states,
verification budget/cache, branch index) that needs transactional queries and safe concurrent writes from
multiple worktrees.

Options considered: files-only (markdown + JSON); SQLite-only (render markdown on demand); hybrid.

## Decision

**Hybrid.** Git-tracked markdown is the **source-of-truth for prose**; **SQLite** (`better-sqlite3`) is the
engine's **operational index**.

- Markdown / files under `.autopilot/`: `pilot/PROFILE.md` (versioned), `pilot/profile-history/`,
  `policy/blast-radius.yml`, `glossary/PROJECT.md`, `architecture/`, `decisions/*.md` (rationale),
  `missions/<id>/` (PRD/ADRs/issues/handoff), `lessons/`, `knowledge/PROJECT.md` (Project-knowledge store —
  ADR-0007).
- SQLite: Decision DAG nodes/edges (declared/derived/checked), review states, verdict/budget cache, branch
  index, optional working-memory rolling-summary rows.
- Derived/git-ignored: `memory/<mission>/step-<n>.md` — the materialized **memory view** (ADR-0007),
  always regenerable from the above; never a source of truth.

Rule of thumb: prose a human reads → markdown; structured state the engine queries → SQLite. Where both
exist for one decision (rationale .md + node row), the markdown is canonical for content and the row is the
index/operational record.

## Consequences

- Positive: legible, diffable, git-native memory (good for comprehension + the loop-engineering "memory on
  disk" principle) plus fast graph queries and race-safe concurrent worktree writes.
- Negative / watch-outs: two stores to keep consistent — need a clear write path (engine writes both in one
  operation) and a rebuild-index-from-files recovery routine so SQLite can be regenerated from the canonical
  markdown if it drifts or is deleted.
