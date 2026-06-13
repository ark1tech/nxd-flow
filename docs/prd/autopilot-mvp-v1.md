# PRD — Autopilot MVP (v1)

> Source: solidified design in `docs/idea/notes.md` (grilling sessions, 2026-06-13).
> Triage: `ready-for-agent`.
> Glossary terms used throughout: **Pilot, Mission, Decision Node, Decision DAG, Profile,
> Blast-radius, Escalation, Branch/Pivot, Comprehension-Debt Meter, Lesson, Checkpoint.**

---

## Problem Statement

When you hand a real feature to an autonomous coding loop, two things go wrong as the loop gets
*smoother*, not better: your understanding of the code rots (comprehension debt), and you slide into
taking whatever the loop produces without an opinion (cognitive surrender). Existing loop tooling
(Codex, Claude Code, Cursor's multi-agent vision) optimizes for **throughput** — it ships code fast but
leaves you unable to answer "why was it built this way?" and gives you no cheap way to explore "what if
that decision had gone differently?" without manually unwinding work.

As a builder, I want an autonomous loop that runs ahead of me **and keeps me the engineer**: I should
always be able to see *which consequential decisions* were made on my behalf, *why*, understand them on
demand, and **change any one decision and watch the loop re-react** — without it being a naggy approval
treadmill or a black box.

## Solution

**Autopilot** is an autonomous build loop with a **Pilot** agent that acts as the user. The Pilot drives
the loop (plan → decide → implement → handoff) and logs every *consequential* choice as a structured
**Decision Node** in a **Decision DAG** — the spine of the system. The human gets three things existing
loops don't:

1. **Grounded autonomy** — the Pilot decides on its own using a learned **Profile**, and only escalates
   to the human on evidence (not a hallucinated confidence score): a decision is paused only when it's
   high **blast-radius** AND (uncovered by the profile OR a separate checker agent disagrees).
2. **A Comprehension-Debt Meter** — every consequential decision is visible and "unreviewed" debt is a
   literal, blast-radius-weighted number you choose when to pay down (via an in-depth on-demand
   **Lesson**). Non-blocking; it makes Addy Osmani's "comprehension debt" concrete.
3. **Decision branching (git-for-decisions)** — fork any Decision Node, override it, and the loop
   re-runs **only the affected subtree** in an isolated git **worktree**, re-implementing just the code
   that depended on it, so you compare two coherent versions side-by-side.

v1 proves the full thesis on **one Mission, end-to-end, with real code**, implemented serially.

## User Stories

1. As a builder, I want to give Autopilot a rough feature idea, so that it can start a Mission without me
   writing a spec first.
2. As a builder, I want Autopilot to grill *me* once up front about my taste, constraints, and
   non-negotiables, so that the Pilot can later decide the way I would.
3. As a builder, I want my answers saved to a persistent `PROFILE.md`, so that the Pilot reuses them across
   the Mission and future Missions.
4. As a builder with an existing repo, I want the Profile seeded from signals already present
   (`AGENTS.md` / `README` / `CONTEXT` / conventions), so that cold-start isn't a blank slate.
5. As a builder, I want the Pilot to autonomously produce a plan and architecture for the feature, so that
   I don't have to drive every step.
6. As a builder, I want every *consequential* decision the Pilot makes recorded as a Decision Node with
   its question, options, chosen option, rationale, and cited evidence, so that nothing important is
   silent.
7. As a builder, I want trivial/micro choices to stay invisible, so that the decision history is small
   enough to read and branch.
8. As a builder, I want each Decision Node classified by blast-radius via a deterministic, auditable rule
   (not the model's opinion), so that I can trust *why* something was flagged risky.
9. As a builder, I want to see exactly which blast-radius rule fired for a decision, so that I can tune the
   policy to my project.
10. As a builder, I want the Pilot to decide autonomously by default and only escalate to me when a
    decision is high blast-radius AND (uncovered OR a checker disagrees), so that I'm interrupted rarely
    and only for load-bearing calls.
11. As a builder, I want every escalation to show its supporting evidence, so that I can answer it quickly
    and confidently.
12. As a builder, I want a separate checker agent (different model/prompt) to independently re-derive
    high-blast-radius decisions, so that the maker isn't grading its own homework.
13. As a builder, I want verification spend to scale with blast-radius (none for low, cheap coverage check
    for medium, full re-derivation for high), so that I'm not paying full price to verify trivia.
14. As a builder, I want a per-Mission verification budget that *escalates when exhausted* rather than
    silently skipping checks, so that cost never quietly degrades safety.
15. As a builder, I want the Pilot to implement the feature's issues as real code, serially, so that the
    Mission produces a working result.
16. As a builder, I want a handoff document per issue (deviations, self-made decisions, tradeoffs), so that
    the next sprint — and I — can pick up cleanly.
17. As a builder, I want a live onboarding feed of decisions and progress as the loop runs, so that I can
    follow along without reading the code.
18. As a builder, I want a Comprehension-Debt Meter showing unreviewed decisions weighted by blast-radius,
    so that the invisible debt becomes a number I can act on.
19. As a builder, I want to click any Decision Node and get an in-depth, on-demand Lesson (concept + why
    this fit my profile + tradeoffs + what the alternative would've meant), so that I can pay down debt for
    that decision.
20. As a builder, I want a side-chat preloaded with a decision's full context when I open it, so that I can
    interrogate it, and optionally save the result as a Lesson to `.autopilot/lessons/`.
21. As a builder, I want marking a decision "reviewed" to lower the debt score, so that the meter reflects
    what I actually understand.
22. As a builder, I want to fork any Decision Node and override its choice, so that I can explore a
    different architectural direction.
23. As a builder, I want a fork to spin up an isolated git worktree from that decision's checkpoint, so
    that my original branch is untouched.
24. As a builder, I want a pivot to invalidate and re-run ONLY the decisions (and code) that transitively
    depended on the changed node, so that re-execution is fast and coherent.
25. As a builder, I want decisions that didn't depend on the changed node to be reused, so that the pivot
    doesn't pointlessly churn unrelated code.
26. As a builder, I want to compare the original and the branched version side-by-side (plans and code), so
    that I can choose a direction with evidence.
27. As a builder, I want the dashboard to diff "what changed because of my pivot," so that the effect of my
    override is obvious.
28. As a builder, when I override a decision I want to choose the *scope* of what's learned — just once /
    this context / general principle — so that a one-off correction doesn't become a permanent law.
29. As a builder, I want profile rules I teach to start provisional and only harden with repetition, weaken
    on conflict, and decay when stale, so that the Pilot tracks my durable taste, not noise.
30. As a builder, I want conflicting profile updates surfaced ("contradicts X from <date> — replace /
    scope / keep both?"), so that my profile never silently self-contradicts.
31. As a builder, I want my Profile versioned, diffable, and revertible with each change attributed to its
    cause, so that I stay the author of my own preferences.
32. As a builder, I want escalation to be intentionally more conservative while the profile is thin and
    relax as it fills, with the "training wheels" state visible, so that the first Mission isn't annoying
    but also isn't reckless.
33. As a builder, I want all durable memory (Profile, glossary, ADRs, rationale, lessons) stored as
    git-tracked markdown, so that it's human-readable, diffable, and survives between runs.
34. As a builder, I want the engine to run as a local daemon I can start/stop, so that I control when the
    loop is active.
35. As a builder, I want the dashboard to stream live from the engine, so that I watch decisions appear in
    real time rather than polling.
36. As a builder, I want the pilot to remember durable facts about my repo (conventions, gotchas, "use X not
    Y") across missions, so that it stops re-learning the same things and decides consistently.
37. As a builder, I want a remembered fact re-validated against the current repo before it can influence a
    risky decision, so that stale memory never silently suppresses an escalation.

## Implementation Decisions

**Execution & runtime**
- The orchestrator drives agents via the **Cursor SDK** (`@cursor/sdk`, TypeScript), **local runtime**
  (`local: { cwd }`) — each Mission/branch runs against a real git worktree on the user's machine.
- **Stepped loop (ADR-0006):** the orchestrator owns loop granularity. Bounded runs *propose* decisions via
  MCP; the `DecisionGate` runs between runs; the next step launches via `Agent.resume` only after a decision
  clears. The `.autopilot` MCP server is passed **inline** on each `create`/`send`/`resume` (inline servers
  are not persisted across resume).
- Maker and auditor = two SDK `Agent`s with different models (the auditor critiques, it does not re-derive).
- v1 is **single-mission, serial** implementation of issues. (Parallel/Amdahl scheduling and cloud runtime
  are out of scope — see below.)
- **Demo/fixture target:** v1 targets **TypeScript/JS**. A small fixture TS service (Fastify/Express REST
  API) lives under `fixtures/`; the demo Mission is "add authentication" (exercises the JWT↔sessions pivot
  and real blast-radius surfaces). `EdgeDeriver` v1 uses **git-diff file-overlap only** (import graph
  deferred).

**Surfaces**
- A **standalone Node/TS orchestrator daemon** owns the loop, the DAG, worktrees, the heartbeat, and SDK
  agent handles. It exposes **WebSocket** (live decision/agent-event stream) + **REST** (actions: branch,
  pay-debt/review, set override-scope).
- The **dashboard** is a **Vite + React + Tailwind** SPA; the Decision DAG is rendered with **React Flow**.
  Thin client over the daemon's WS/REST.

**State / persistence (hybrid)**
- Git-tracked human-readable files are source-of-truth for prose; **SQLite** (`better-sqlite3`) is the
  engine's operational index for graph + operational state.
- On-disk layout under `.autopilot/`:
  - `pilot/PROFILE.md` (versioned), `pilot/profile-history/` (attributed deltas)
  - `policy/blast-radius.yml` (deterministic surface→tier rules; seeded by onboarding grill, overridable)
  - `glossary/PROJECT.md`, `architecture/`, `decisions/` (per-node rationale .md), `missions/<id>/`
    (PRD/ADRs/issues/handoff), `lessons/`, `knowledge/PROJECT.md` (Project-knowledge store — ADR-0007)
  - `memory/<mission>/step-<n>.md` — the **materialized memory view** (ADR-0007); derived + git-ignored,
    always regenerable; never a source of truth.
  - SQLite DB (the `DecisionStore`) holds: Decision Nodes, edges (declared/derived/checked), review states,
    verdict/budget cache, branch index, optional working-memory rolling-summary rows. (Debt is *computed*
    from this by `DebtMeter`, not stored.)

**Decision DAG (the spine)**
- A choice is **auto-consequential** if it touches any blast-radius surface OR introduces a foundational
  dependency (deterministic floor); the Pilot may additionally flag an architecturally-interesting
  low-blast-radius choice but can never demote one the floor caught.
- Each Decision Node: `{ question, options, choice, rationale, citedEvidence, citedSurfaces, dependsOn[] }`.
- **Edges are multi-source:** *declared* (Pilot cites prior nodes/profile/files at decision time — a
  hint), *derived* (computed from the real artifact/import/file-overlap graph — ground truth), *checked*
  (completeness pass on high-tier nodes). The same DAG drives pivot-invalidation and (later) scheduling.

**Loop ownership (stepped) — see ADR-0006**
- The **orchestrator owns the loop**. Each bounded agent run ends by **proposing** its consequential
  decision(s) via MCP (`propose_decision` + `cite_surfaces`/`cite_dependencies`); it does not silently
  build on them. The orchestrator runs the gate between runs and only proceeds (`Agent.resume`) once a
  decision clears. **Escalation = don't launch the next step until answered** (no mid-run suspend).

**Grounded escalation (one `DecisionGate` seam)**
- Surfaces are **multi-source**: *cited* by the Pilot **plus** *derived from the actual diff/changed files*.
  A deterministic `BlastRadiusClassifier` assigns the tier from the union and records which rule fired. The
  model never rates its own risk/confidence, and never single-sources the surfaces.
- The auditor is a **critic, not a re-deriver**: it judges whether a proposed decision is defensible and
  whether its surfaces/coverage/dependencies are correct (→ `{ok | flag}`), and performs edge/surface
  completeness in the same call.
- `EscalationPolicy`: escalate iff `tier ∈ {high, critical} AND (uncovered-by-profile OR auditor-flags)`.
- Verification is **risk-proportional**: low → no audit; medium → cheap coverage-only audit; high/critical
  → full audit. Verdicts cached by `hash(normalized question + cited evidence)`; reviewed nodes skipped.
  A per-Mission budget escalates when exhausted (never silently skips a critical audit).
- These compose into `DecisionGate.evaluate(decision) → { decide | escalate, evidence }` — the orchestrator
  calls it once per proposed decision.

**Branching / pivots**
- Every Decision Node is a **Checkpoint** = git commit/tag (one commit per node, guaranteed by the stepped
  loop) + a loop-state snapshot.
- A pivot forks a new **git worktree** from the checkpoint and applies the override.
  `invalidationSet(n)` = the transitive dependents, which are **re-run with fresh agent runs**; everything
  else is **reused by commit-replay** (its original commits are replayed into the new worktree — *not*
  regenerated, because LLM output is non-deterministic). **Conservative rule:** when a dependency is
  uncertain, include it in the invalidation set (re-running is always safe; reusing something that should
  have changed is the only dangerous direction). After a pivot, a produced-artifact diff catches any missed
  edge and adds it (self-correcting).

**Comprehension debt & lessons**
- `DebtMeter` = sum of unreviewed consequential nodes weighted by blast-radius tier; optional ceiling that
  escalates when crossed. Non-blocking.
- Lessons are **on-demand**: opening a node launches a side-chat preloaded with its full context; "Save as
  lesson" writes in-depth content to `.autopilot/lessons/`. (Auto-lesson generation is out of scope.)

**Profile learning (drift-safe)**
- An override never silently edits `PROFILE.md`; it creates a **proposed delta** and asks for **scope**
  (once / context / global). Learned rules are provisional + weighted, harden on corroboration, weaken on
  conflict, decay when stale. Conflicts are surfaced; profile is versioned/diffable/revertible.

**Cold-start ramp**
- (1) richer one-time onboarding grill seeds `PROFILE.md`; (2) seed from existing repo signals if present;
  (3) escalation runs more conservatively while coverage is low and relaxes as it fills — "training
  wheels" state shown in the UI.

**Module decomposition (deep modules behind stable interfaces)**
- One transactional state repo: **`DecisionStore`** (SQLite) owns Decision Nodes, edges (declared/derived/
  checked), and review-state. Single source of operational truth; graph algorithms (`transitiveDependents`,
  `invalidationSet`, `topoOrder`) live here.
- Pure-logic functions over that state (the brains): `BlastRadiusClassifier`, `EscalationPolicy`,
  `EdgeDeriver` (v1: git-diff overlap), `ProfileStore`, `DebtMeter` (pure scoring fn — *not* a store).
  Verdict cache + verification budget are cached over the store, not a standalone module.
- Composition seam: **`DecisionGate`** = classify → coverage → audit → escalation, returning
  `{decide | escalate, evidence}`. The `LoopEngine` calls it once per proposed decision.
- Adapters/boundaries: `AgentRunner` (wraps `@cursor/sdk`; maker vs auditor model), `AutopilotMcpServer`
  (engine ops as MCP tools: `propose_decision`, `cite_surfaces`, `cite_dependencies`, `get_profile`,
  `coverage_for`, `propose_knowledge`, `read_memory`/`read_knowledge`, `record_handoff`, `read_state`),
  `WorktreeManager` (worktree checkpoint/fork/commit-replay/compare/cleanup), `LoopEngine` (the **stepped**
  orchestrator wiring store + gate + AgentRunner through plan→decide→implement→handoff), `DashboardGateway`
  (WS + REST).

**Memory (ADR-0007)** — *not a store*; a retrieval **view**. The only new source of truth is the small
`knowledge/PROJECT.md` (durable empirical repo facts, provenance + last-confirmed). Working memory is
ephemeral/derived (assembled per step). Capture is gated (`propose_knowledge`, deduped, audited when
load-bearing); reads are grounded (a knowledge fact only counts as coverage for a medium+ decision if its
provenance re-validates against the repo — else degrade toward escalate). Per-step context is assembled
hybrid push+pull within a token budget and materialized (git-ignored) under `memory/` for inspection.

## Testing Decisions

- **What makes a good test:** assert external behavior through the module's public interface — given
  inputs/state, assert outputs/persisted effects. No assertions on internal calls or private structure;
  tests must survive refactors of the implementation.
- **Tested hard (unit, isolated):** the pure-logic brains + the store's graph algorithms. Behavior to cover:
  - `BlastRadiusClassifier` — each surface maps to the expected tier; correct `ruleFired`; policy overrides
    take effect; foundational-dependency → high even with few files; classifies over the **union** of cited
    + derived surfaces. (Trust anchor — highest coverage.)
  - `EscalationPolicy` — the truth table over (tier × coverage × auditor-flag); training-wheels conservatism
    at low coverage.
  - `DecisionStore` — `transitiveDependents`/`invalidationSet` correctness on diamond/cyclic-guard graphs;
    reused vs invalidated partition; `topoOrder`; transactional review-state writes.
  - `EdgeDeriver` (v1) — derives a `N→M` edge from git-diff file-overlap even when undeclared (fixture repos).
  - `ProfileStore` — scope handling (once/context/global), provisional→hardened on corroboration, weaken on
    conflict, decay when stale, conflict detection, revert. (Drift logic — highest coverage.)
  - `DebtMeter` (pure fn) — weighted score, review lowers it, ceiling triggers.
  - Verification budget (over the store) — intensity per tier, cache hit/miss by decision hash,
    budget-exhaustion escalation, skip of reviewed nodes.
  - `DecisionGate` — composes the above into `{decide | escalate, evidence}` correctly per the policy.
- **Integration-tested (lightly, with fixtures):** `AgentRunner` (mock SDK), `AutopilotMcpServer`,
  the **auditor** (mock SDK; flag vs ok), `WorktreeManager` incl. **commit-replay** (temp git repos),
  `LoopEngine` (one end-to-end happy-path stepped Mission against the TS fixture).
- **Prior art:** none yet (greenfield). Establish the unit-test harness (e.g. Vitest) with the first
  pure-logic module and mirror its structure for the rest.

## Out of Scope

- Multi-mission / multi-issue **parallel scheduling** (Amdahl across worktrees) — v1 implements serially.
- **Cloud runtime** (hosted VMs, `autoCreatePR`) and any account/multi-tenant/hosting concerns.
- **Auto-generation** of lessons for every decision (v1 is on-demand only).
- Advanced/ML-based profile learning beyond the provisional-weighting + corroboration/decay rules above.
- Editor-agnostic backends (Claude Code / Codex) behind an abstraction layer.
- Packaging/distribution as a Cursor plugin, and publishing missions as real PRs.

## Further Notes

- **Governing principle** (enforced everywhere): the LLM produces grounded, citable *evidence*; a
  deterministic rule or explicit human consent produces the *verdict*. Every mechanism degrades safely —
  toward "ask the human" or "re-run too much," never toward "silently wrong."
- **Demo target** (the acceptance feel): give Autopilot a rough feature → it grills you once → autopilots
  the Mission with decisions streaming into the feed and exactly one well-justified escalation → ships
  working code → you pivot a load-bearing decision (e.g. JWT→sessions) and watch a worktree grow the
  alternative, diffing only what changed → you open a node, save a lesson, and watch the debt meter drop.
- **Key risks to watch during build:** blast-radius policy tuning (trust anchor); auditor token cost;
  edge/surface under-citing (mitigated by multi-source derived edges/surfaces + conservative pivots +
  auditor completeness); profile overfitting (mitigated by scoped/provisional learning); the stepped-loop
  step prompt reliably making the Pilot stop-and-propose.
- **ADRs:** 0001 Cursor SDK + local runtime · 0002 daemon + SPA · 0003 hybrid SQLite+markdown ·
  0004 Decision DAG + multi-source edges + commit-replay reuse · 0005 grounded decisioning (evidence vs
  verdict, auditor, `DecisionGate`) · 0006 orchestrator-stepped loop.
- **Issues:** v1 is sliced into vertical tracer bullets `S1…S8` (see `docs/issues/`), starting with a
  walking skeleton (idea → one proposed decision → live in the feed) and thickening from there.
- **Glossary:** canonical terms in `docs/GLOSSARY.md` (destined for `.autopilot/glossary/PROJECT.md`).
```
