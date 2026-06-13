# ADR-0007 — Memory is a view; one small Project-knowledge store; grounded reads

- Status: Accepted
- Date: 2026-06-13
- Related: ADR-0003 (state), ADR-0005 (grounded decisioning / coverage), ADR-0006 (stepped loop),
  `docs/GLOSSARY.md`

## Context

The pilot needs context ("memory") to decide well, and the project wants it written to `.autopilot/memory`.
But Autopilot already persists a great deal of "memory on disk": `PROFILE.md` (user preferences),
`glossary/PROJECT.md` (vocabulary), the Decision DAG (per-mission decisions + evidence), `missions/<id>/`
handoffs (per-issue impl notes), `lessons/`, and `architecture/`. A loosely-defined `memory/` would
duplicate these and create stale, contradictory state — the "silently wrong" failure mode this project
engineers against. Two things, however, are genuinely **not** captured by any existing artifact:

1. **Working memory** — the stepped loop (ADR-0006) resumes the pilot per step and needs a compact running
   context so each step doesn't re-derive everything.
2. **Empirical project-knowledge** — durable, cross-mission, agent-facing facts about *this* repo
   (conventions, gotchas, env quirks, "use X not Y", load-bearing modules) that are not preferences, not
   vocabulary, not a single decision, and not ADR-worthy trade-offs.

## Decision

**Memory is a retrieval *view*, not a store.** It owns no source of truth; it assembles decision-time
context from canonical artifacts. The only *new* source of truth is one small, strictly-scoped store.

1. **Working memory — ephemeral + derived.** Assembled each step from canonical state (current Mission's
   decisions/edges/rationale + latest handoff + coverage-matched Profile/glossary), with at most a
   regenerable rolling-summary row cached on the existing `DecisionStore`. No new store.
2. **Project-knowledge — one small store** at `.autopilot/knowledge/PROJECT.md`. Structured, agent-facing
   facts, each with **provenance** (evidencing mission/decision/file) and **last-confirmed/confidence**.
3. **Capture is gated + ground-truth-deduped** (mirrors decision discipline): the pilot **proposes** facts
   via MCP (`propose_knowledge`) with provenance at step/handoff boundaries; a fact gets a lightweight
   auditor check before it may shape future high-blast decisions. Dedup/merge keys by **(subject + claim)**
   (subject = the locator target — file/symbol/dep — where possible, else normalized text): same
   subject+claim ⇒ refresh last-confirmed (no dup); same subject + **contradictory** claim ⇒ resolved by
   **re-validation (which fact still holds wins)**, not recency; if both/neither hold ⇒ mark **contested**
   (grants no coverage, surfaced for auditor/human); new subject ⇒ add. (Embedding-similarity dedup for
   paraphrases is a later enhancement on top of this.)
4. **Reads are grounded — typed-locator re-validation.** Each fact stores a provenance **kind + locator**:
   (i) *file/symbol* — the cited path/range exists and its content-hash/snippet still matches; (ii)
   *pattern* — the cited grep still matches; (iii) *command* — a cheap check resolves (e.g. dependency
   present in `package.json`). When a fact would count as **coverage** for a medium+ decision (ADR-0005),
   the engine re-validates the locator (with a **git-touch fast-path**: skip the check when nothing in the
   provenance area changed since last-confirmed): resolves ⇒ counts; fails ⇒ does not count (degrade toward
   escalate) + flag. A fact with **no machine-checkable locator is hint-only** and can never grant coverage.
   Memory can inform decisions but can **never silently suppress an escalation**.
5. **Assembly is hybrid push+pull, budget-capped.** The engine pre-assembles a bounded, blast-radius-
   prioritized core pack AND exposes MCP read tools for the pilot to pull more. The pack is **materialized**
   under `.autopilot/memory/<mission>/step-<n>.md` as an always-regenerable, **git-ignored** cache for
   inspection — never a source of truth.

## Consequences

- Positive: no concept duplication (each existing artifact keeps one meaning); "rely on memory" becomes a
  concrete, inspectable assembly step; memory is folded under the same evidence-vs-verdict invariant, so it
  cannot become a stale backdoor around escalation; only one small new store to maintain.
- Negative / watch-outs: facts must carry a machine-checkable locator to earn coverage (true-but-unlocatable
  facts stay hints — acceptable, and it keeps grounding strict); content-hash/snippet matching needs a
  sensible "still matches" tolerance (cosmetic vs semantic change); core-pack retrieval relevance and
  paraphrase dedup start simple (structural + keyword) with embeddings as a later enhancement; a `contested`
  fact needs a resolution path (auditor/human) so it doesn't linger forever.
