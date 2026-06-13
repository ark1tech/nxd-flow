# Autopilot — docs index

A loop-engineering build system with a **Pilot** that runs ahead of you while you **stay the engineer**.

## Start here
- **Idea / design (source of truth):** [`idea/notes.md`](idea/notes.md)
- **Glossary (canonical vocabulary):** [`GLOSSARY.md`](GLOSSARY.md)
- **PRD (MVP v1):** [`prd/autopilot-mvp-v1.md`](prd/autopilot-mvp-v1.md)

## ADRs
- [ADR-0001 — Execution substrate: Cursor SDK, TypeScript, local runtime](adr/0001-execution-substrate-cursor-sdk-local-typescript.md)
- [ADR-0002 — Surface: standalone daemon + SPA over WS/REST](adr/0002-surface-daemon-plus-spa.md)
- [ADR-0003 — Hybrid state: markdown memory + SQLite index](adr/0003-hybrid-state-markdown-memory-sqlite-index.md)
- [ADR-0004 — Decision DAG spine, multi-source edges, commit-replay reuse](adr/0004-decision-dag-spine-multi-source-edges.md)
- [ADR-0005 — Grounded decisioning: evidence vs. verdict (auditor, `DecisionGate`)](adr/0005-grounded-decisioning-evidence-vs-verdict.md)
- [ADR-0006 — Orchestrator owns the loop (stepped runs, gate between steps)](adr/0006-orchestrator-stepped-loop.md)
- [ADR-0007 — Memory is a view; one small Project-knowledge store; grounded reads](adr/0007-memory-as-view-plus-knowledge-store.md)

## Issues (vertical tracer-bullet slices)

Each slice cuts through all layers and is demoable on its own. Pure-logic modules are built inside the slice
that first needs them. Flow: `S1 → S2a → {S2b, S4} → S3 → {S5, S7} → {S6, S8}`.

| # | Slice | Type | Blocked by | Stories |
|---|-------|------|------------|---------|
| 001 | [S1 — Walking skeleton: idea → proposed decision → live feed](issues/001-walking-skeleton.md) | AFK | — | 1,5,6,17,34,35 |
| 002 | [S2a — Classification (blast-radius) from cited+derived surfaces](issues/002-classification-in-feed.md) | AFK | 001 | 6,7,8,9 |
| 003 | [S2b — Grounded gate: high-blast + uncovered/flagged pauses loop](issues/003-grounded-gate-escalation.md) | HITL | 002 | 10,11,12,13,14 |
| 004 | [S4 — Onboarding grill → PROFILE.md + cold-start ramp](issues/004-onboarding-profile-coldstart.md) | HITL | 002 | 2,3,4,32 |
| 005 | [S3 — Full serial Mission: plan→decide→implement→handoff](issues/005-full-serial-mission.md) | AFK | 003 | 5,6,7,15,16 |
| 006 | [S5 — Comprehension-debt meter + on-demand lessons](issues/006-debt-meter-and-lessons.md) | AFK* | 005 | 18,19,20,21,33 |
| 007 | [S7 — Pivot: commit-replay reuse, re-run dependents, compare](issues/007-pivot-branching.md) | HITL | 005 | 22,23,24,25,26,27 |
| 008 | [S6 — Decision DAG visualizer (React Flow)](issues/008-dag-visualizer.md) | AFK | 006, 007 | 17 |
| 009 | [S8 — Drift-safe profile learning from overrides](issues/009-drift-safe-profile-learning.md) | HITL | 007, 004 | 28,29,30,31 |
| 010 | [S9 — Memory view + Project-knowledge store (grounded reads)](issues/010-memory-and-project-knowledge.md) | AFK | 005 | 36,37 |

\* AFK, with a HITL touchpoint when the human opens a lesson.

Flow with memory: `… → S3 → {S5, S7, S9}`. S9 deepens coverage used by S3/S4.

## The one principle behind all of it
The LLM produces grounded, citable **evidence**; a deterministic rule or explicit human **consent** renders
the **verdict**. Every mechanism degrades toward *ask the human* or *re-run too much* — never *silently
wrong*.
