# ADR-0008 — Execute missions in isolated scratch repos with a real code gate

- Status: Accepted
- Date: 2026-06-13
- Related: ADR-0001, ADR-0004, ADR-0006, PRD `docs/prd/autopilot-mvp-v1.md`

## Context

Autopilot needs one real git checkpoint per Decision Node so pivoting can fork from a checkpoint and replay
independent commits. Running those commits in the Autopilot tool repository would pollute the product's own
history and make demos unsafe. The v1 demo target is the fixture TypeScript service, but the loop still
needs real files, real tests, and real diffs for the baseline to prove "ships working code" rather than
only writing planning artifacts.

## Decision

Each Mission runs against an isolated, git-ignored scratch repository under `.autopilot/worktrees/`.

- The engine copies the target fixture into `.autopilot/worktrees/scratch/<mission-id>/`.
- The scratch copy is initialized as its own git repository with an initial base commit.
- Every cleared Decision Node creates a real git commit in that scratch repository.
- Pivots create git worktrees from those scratch commits and replay independent commits into the branch.
- The Autopilot product repo itself is never committed to by mission checkpoints.

The implementation gate for code-producing steps is the target project's own verification command set
(v1 fixture: build/typecheck and tests). A failed gate retries or escalates; it does not silently produce a
checkpoint.

## Consequences

- Positive: commit-replay and side-by-side pivot comparison become literal without mutating the tool repo.
- Positive: `pnpm verify` can use deterministic mock replay while `pnpm demo` can use the same scratch repo
  mechanics with live Cursor SDK agents.
- Negative / watch-outs: scratch repos are generated runtime state, so tests and docs must make it clear
  that the shipped code for a Mission lives under `.autopilot/worktrees/`, not the fixture source itself.
- Deferred: multi-target project selection beyond the v1 fixture is a post-baseline product decision.
