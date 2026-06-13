# ISSUE-010 (S9) — Memory view + Project-knowledge store (grounded reads)

- Type: AFK
- Triage: ready-for-agent
- User stories: 36, 37 (supports 5, 10)
- Refs: ADR-0007 (memory), ADR-0005 (coverage), ADR-0006 (working memory), `docs/GLOSSARY.md`

## Context (read first)
The pilot decides better with context ("memory"), but Autopilot already persists most "memory on disk"
(Profile, glossary, Decision DAG, handoffs, lessons). **Memory is therefore a retrieval *view*, not a new
store** (ADR-0007). The single genuinely-uncaptured durable thing — empirical, cross-mission, agent-facing
repo facts (conventions, gotchas, env quirks, load-bearing modules) — gets one small store,
`.autopilot/knowledge/PROJECT.md`. The hard requirement: memory must obey the project's safety invariant —
it can inform decisions but can **never silently suppress an escalation** via a stale fact.

A basic per-step context pack already exists from the walking skeleton (S1); this slice adds the durable
knowledge store, gated capture, grounded reads, and the assembled+materialized memory view.

## What to build
- **Project-knowledge store** (`knowledge/PROJECT.md`): structured facts, each with provenance (evidencing
  mission/decision/file) + last-confirmed/confidence.
- **Gated capture**: MCP `propose_knowledge` (with provenance), invoked mostly at step/handoff boundaries;
  engine dedupes/merges (refresh last-confirmed rather than duplicate); a fact gets a lightweight auditor
  check before it may shape future high-blast decisions.
- **Grounded reads / coverage**: when a knowledge fact would count as coverage for a medium+ decision, the
  engine re-validates its provenance against the current repo (fresh ⇒ counts; stale/unverifiable ⇒ does
  not count ⇒ degrade toward escalate + flag). Low-stakes reads use it as a hint.
- **Memory view (assembly)**: per step, pre-assemble a bounded, blast-radius-prioritized core pack (current
  Mission decision-subtree + latest handoff + coverage-matched Profile/glossary/knowledge) within a token
  budget; expose MCP `read_memory`/`read_knowledge` pull tools; materialize the pack (git-ignored) under
  `memory/<mission>/step-<n>.md`.

## Acceptance criteria
- [ ] `propose_knowledge` writes a fact with a typed provenance locator (file/symbol | pattern | command);
      a fact with no machine-checkable locator is stored hint-only and can never grant coverage.
- [ ] Dedup/merge keys by (subject + claim): same ⇒ refresh last-confirmed; contradictory ⇒ resolved by
      re-validation (which still holds wins); both/neither hold ⇒ `contested` (no coverage).
- [ ] A load-bearing fact is audited before it can serve as coverage.
- [ ] A fact whose locator still resolves counts as coverage for a medium+ decision (git-touch fast-path
      skips the check when unchanged); a fact whose locator fails does NOT count and the decision degrades
      toward escalation (flagged for re-confirm).
- [ ] The per-step core pack is bounded by a token budget and includes the current Mission's decision-subtree
      + latest handoff + coverage-matched entries; pull tools return additional memory on request.
- [ ] The assembled pack is materialized under `memory/` (git-ignored) and is byte-regenerable from
      canonical state.
- [ ] Unit tests: dedup/merge; provenance re-validation (fresh vs stale → coverage vs escalate); assembly
      respects the budget and includes the mandatory core.

## Blocked by
- ISSUE-005 (S3). (Coverage integration also touches ISSUE-003/004; capture sources come from real Missions.)
