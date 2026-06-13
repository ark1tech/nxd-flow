# Autopilot — Glossary

The project's domain vocabulary. Use these exact terms in code, PRDs, ADRs, and issues. This is the
canonical source destined for `.autopilot/glossary/PROJECT.md`.

- **Autopilot** — the system: an autonomous build loop with a Pilot that runs ahead of the human while
  the human "stays the engineer."
- **Pilot** — the agent that acts *as the user*, making decisions from the user's Profile. Runs as bounded
  steps under the orchestrator (see *Stepped loop*), never one long uninterrupted run.
- **Orchestrator / `LoopEngine`** — the daemon that *owns the loop*. It launches bounded agent runs,
  runs the `DecisionGate` between them, and only proceeds when a decision clears the gate. "You write the
  loop, not the prompt."
- **Stepped loop** — the execution model: each agent run ends by *proposing* its consequential
  decision(s) via MCP rather than silently building on them; the orchestrator gates between runs and
  resumes (`Agent.resume`) for the next step. Escalation = "don't launch the next step until answered"
  (no mid-run suspend).
- **Mission** — the top-level unit of work: one feature/change. Runs the full pipeline
  (plan → decide → implement → handoff). Project-level memory (Profile, glossary, architecture, ADRs)
  persists across Missions.
- **Decision Node** — a *consequential* choice:
  `{ question, options, choice, rationale, citedEvidence, citedSurfaces, dependsOn[] }`. The atom of the
  system; one git commit per node where it produces code (a *Checkpoint*).
- **Decision DAG** — the dependency graph of Decision Nodes. The single core data structure; powers
  pivot-invalidation now and (later) serial/parallel scheduling.
- **Decision Store** — the one transactional (SQLite-backed) repository that owns Decision Nodes, edges,
  and review-state. The single source of operational truth (debt and budget are computed/cached over it,
  not stored separately).
- **Edge (declared / derived / checked)** — a dependency between nodes. *Declared* = Pilot-cited (hint);
  *derived* = computed from the real diff/file-overlap (ground truth); *checked* = auditor completeness
  pass on high-tier nodes.
- **Surface** — a concrete, detectable thing a decision touches (DB schema/migrations, public API,
  auth/security, money/billing, data lifecycle, foundational dependency, cross-cutting). **Multi-source:**
  cited by the Pilot *plus* derived from the actual diff. Input to blast-radius.
- **Blast-radius / Tier** — `{low, medium, high, critical}`, assigned by the deterministic
  `BlastRadiusClassifier` from Surfaces (proxy for reversibility cost / one-way-doorness). Also defines
  the *consequential floor* (touching any surface ⇒ auto-consequential).
- **Profile (`PROFILE.md`)** — the user's taste/constraints/non-negotiables; the Pilot's source of
  judgment. Seeded by the onboarding grill, taught (drift-safely) by overrides, versioned/revertible.
- **Coverage** — whether a decision is supported by grep-citable evidence in Profile/ADRs/glossary
  (and Project-knowledge — see below).
- **Memory** — *not a store.* The retrieval **view** the pilot reads at decision time. Assembled
  **hybrid push+pull**: the engine pre-assembles a bounded, blast-radius-prioritized core pack (current
  Mission decision-subtree + latest handoff + coverage-matched Profile/glossary/Project-knowledge) within a
  token budget, AND exposes MCP read tools so the pilot can pull more. Materialized under
  `.autopilot/memory/<mission>/step-<n>.md` as an always-regenerable, git-ignored cache for inspection —
  never a source of truth.
- **Working memory** — the per-step context pack for the stepped loop. **Ephemeral + derived**: assembled
  each step from canonical state (current Mission's decisions/edges/rationale + latest handoff + covered
  Profile/glossary entries), with at most a regenerable rolling-summary row cached on the `DecisionStore`.
  Not a separate store.
- **Project-knowledge (`.autopilot/knowledge/PROJECT.md`)** — the one small, strictly-scoped *new* store:
  durable, cross-mission, **agent-facing empirical facts about this repo** (conventions, gotchas, env
  quirks, "use X not Y", load-bearing modules) that are not preferences (Profile), vocabulary (glossary),
  per-mission decisions, or ADR-worthy trade-offs. Each fact carries **provenance** (the mission/decision/
  file that evidenced it) and a **last-confirmed/confidence**.
  - *Provenance locator* — a fact's evidence is a machine-checkable **kind + locator**: file/symbol (exists
    & content-hash/snippet matches), pattern (grep matches), or command (e.g. dep present). A fact with no
    such locator is **hint-only** — it can never grant coverage.
  - *Capture* — the pilot **proposes** facts via MCP (`propose_knowledge`) with provenance, mostly at
    step/handoff boundaries; lightly audited before it may shape high-blast decisions. Dedup/merge keys by
    **(subject + claim)**: same ⇒ refresh last-confirmed; contradictory ⇒ resolved by re-validation (which
    still holds wins, not recency); both/neither hold ⇒ **contested** (grants no coverage). Not a free-form
    scratchpad.
  - *Trust on read* — when a fact would count as **coverage** for a medium+ decision, the engine
    re-validates its locator against the current repo (git-touch fast-path); fresh ⇒ counts;
    stale/unverifiable/contested ⇒ does **not** count (degrade toward escalate) + flag. Low-stakes reads use
    it as a hint. So memory can inform decisions but can **never silently suppress an escalation**.
- **`DecisionGate`** — the single composed seam the orchestrator calls per proposed decision:
  classify → coverage → audit → `EscalationPolicy` → `{decide | escalate, evidence}`.
- **Auditor (checker)** — a *separate* agent (different model) that **critiques** a proposed decision
  ("is it defensible, and are its surfaces/coverage correct? yes/no + reason") instead of re-deriving and
  diffing. One cheap, stable call; also performs edge/surface completeness.
- **Escalation** — the loop declines to proceed past a decision and asks the human; fires iff
  `tier ∈ {high, critical} AND (uncovered OR auditor-flags)`. Always shows evidence.
- **Verification budget** — risk-proportional checker spend (low→none, medium→cheap, high/critical→full
  audit), with a verdict cache and a per-Mission ceiling that *escalates when exhausted* (never silently
  skips).
- **Checkpoint** — a Decision Node's restorable point: a git commit/tag (when code exists) plus the
  loop-state snapshot. The fork point for a pivot.
- **Branch / Pivot** — overriding a Decision Node and re-running forward: fork a git **worktree** from the
  node's checkpoint, **commit-replay** the reused (non-dependent) decisions' original commits, and
  re-run only the `invalidationSet` (its transitive dependents) with fresh agent runs.
- **Reuse (carry-forward)** — reused work is **not re-run**; its original commits are replayed into the new
  worktree (LLM output is non-deterministic, so reuse must mean "keep," not "regenerate").
- **`invalidationSet(n)`** — the transitive dependents of node *n* that must be re-run on a pivot;
  everything else is reused. Conservative: when a dependency is uncertain, include it.
- **Comprehension-Debt Meter** — a live, non-blocking score = unreviewed consequential nodes weighted by
  tier; the human pays it down via review/lessons.
- **Lesson** — an in-depth, on-demand explanation of a decision (concept + why it fit the Profile +
  tradeoffs + the alternative), saved to `.autopilot/lessons/`. The "payment" for debt.
- **Handoff** — a per-issue document (deviations, self-made decisions, tradeoffs) for the next sprint and
  the human.
- **`AgentRunner`** — the adapter over `@cursor/sdk` (local runtime; create/send/resume/stream; maker vs
  auditor model; inline MCP; disposal + error taxonomy).
- **`AutopilotMcpServer`** — engine operations exposed to agents as MCP tools (`propose_decision`,
  `cite_surfaces`, `cite_dependencies`, `get_profile`, `coverage_for`, `record_handoff`, `read_state`).
- **`WorktreeManager`** — git worktree/checkpoint lifecycle (checkpoint/fork/commit-replay/compare/cleanup).
- **`DashboardGateway`** — WS event stream + REST actions between the daemon and the SPA dashboard.

## Governing principle
The LLM produces grounded, citable **evidence**; a deterministic rule or explicit human **consent**
renders the **verdict**. Every mechanism degrades toward *ask the human* or *re-run too much* — never
*silently wrong*.
