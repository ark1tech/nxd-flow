# ISSUE-007 (S7) — Pivot: override a decision, commit-replay reuse, re-run dependents, compare

- Type: HITL
- Triage: ready-for-agent
- User stories: 22, 23, 24, 25, 26, 27
- Refs: ADR-0004 (commit-replay + invalidationSet), ADR-0006, `docs/GLOSSARY.md`

## Context (read first)
The headline feature — "git for decisions." The human forks any Decision Node, overrides its choice, and the
loop re-reacts by re-running **only** what depended on it while **reusing** the rest. Crucial reality
constraint: LLM output is non-deterministic, so **reuse means "do not re-run"** — reused decisions are
carried forward by **commit-replay** of their original commits, not regenerated.

## What to build
`WorktreeManager` (checkpoint/fork/commit-replay/compare/cleanup) + the `EdgeDeriver` (v1: git-diff
file-overlap, deriving `N→M` when M's commit touches files N's commit produced) + a `LoopEngine.pivot`
path. On `pivot(nodeId, newChoice)`: fork a worktree from the node's checkpoint; compute
`invalidationSet(nodeId)` over multi-source edges; **re-run only the invalidation set** as fresh stepped
runs (same gate); **commit-replay** the reused (independent) decisions' original commits into the new
worktree. Conservative rule: when a dependency is uncertain, include it in the invalidation set.
Self-correction: after the pivot, diff produced artifacts vs. original; a supposedly-reused artifact that
changed reveals a missing edge → add it + flag. Dashboard: branch picker + **side-by-side compare**
(plans + code) + a "what changed because of your pivot" diff.

## Acceptance criteria
- [ ] `pivot` forks an isolated worktree from the node's checkpoint; the original branch is untouched.
- [ ] Only the transitive dependents are re-run; reused decisions are **commit-replayed** (reused files are
      byte-identical to the originals because they are the original commits).
- [ ] Uncertain dependencies are conservatively included in the invalidation set.
- [ ] A deliberately under-declared edge is caught by the post-pivot artifact diff and added.
- [ ] Dashboard shows side-by-side compare + the pivot diff.
- [ ] Tests: `invalidationSet`/reused partition on diamond graphs (unit); `EdgeDeriver` derives an undeclared
      overlap edge (unit, fixture repos); commit-replay + isolation (integration, temp git repos).

## Blocked by
- ISSUE-005 (S3).
