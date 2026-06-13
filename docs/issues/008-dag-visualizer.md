# ISSUE-008 (S6) — Decision DAG visualizer (React Flow)

- Type: AFK
- Triage: ready-for-agent
- User stories: 17 (deepened), + legibility of 22/24 (pivot entry point)
- Refs: ADR-0002, ADR-0004, `docs/GLOSSARY.md`

## Context (read first)
Make the decision spine legible: a graph the human can read, navigate, review, and pivot from. This turns the
flat feed into the actual Decision DAG so the human can see structure and dependencies — the comprehension
surface.

## What to build
A React Flow view of the Decision DAG: nodes show question/choice + blast-radius tier (color); edges show
dependency kind (declared/derived/checked). Node interactions wire to existing flows: open node (→ lesson
side-chat, ISSUE-006), mark reviewed (→ debt meter, ISSUE-006), **pivot** (→ branch flow, ISSUE-007).
Reviewed vs unreviewed and escalated nodes are visually distinct; after a pivot, overlay the invalidated vs
reused subtree.

## Acceptance criteria
- [ ] The DAG renders nodes + typed edges from `DecisionStore` state, live.
- [ ] Tier is color-coded; reviewed/unreviewed/escalated states are visually distinct.
- [ ] Open/review/pivot actions invoke the correct existing endpoints with the right node id.
- [ ] After a pivot, invalidated vs reused subtrees are visually overlaid.
- [ ] Component/integration test: graph renders from a seeded store; pivot action calls the branch endpoint.

## Blocked by
- ISSUE-006 (S5). (Pivot overlay also relies on ISSUE-007.)
