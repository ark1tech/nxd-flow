# ISSUE-006 (S5) — Comprehension-debt meter + on-demand lessons

- Type: AFK (HITL when the human opens a lesson)
- Triage: ready-for-agent
- User stories: 18, 19, 20, 21, 33
- Refs: ADR-0005, `docs/GLOSSARY.md`

## Context (read first)
The product's soul: keep the human's understanding in sync as the loop ships code they didn't write
(comprehension debt), without blocking the loop. Debt becomes a literal, payable number; the human pays it
down by reviewing a decision or saving an in-depth lesson.

## What to build
`DebtMeter` as a **pure scoring function** over `DecisionStore`: score = unreviewed consequential nodes
weighted by blast-radius tier, with an optional ceiling that emits an escalate signal when crossed. Dashboard
shows the live meter. Clicking a decision opens a **side-chat preloaded with that node's full context**
(question, options, choice, rationale, cited evidence, resulting diff); "Save as lesson" writes in-depth
content (concept + why it fit the profile + tradeoffs + what the alternative would've meant) to
`.autopilot/lessons/`. Marking reviewed / saving a lesson lowers the score.

## Acceptance criteria
- [ ] `DebtMeter` is a pure fn: weighted score correct; review lowers it; ceiling triggers at threshold.
- [ ] Dashboard shows the live debt meter and updates as nodes are reviewed.
- [ ] Opening a node yields a context-complete side-chat payload.
- [ ] "Save as lesson" writes a markdown lesson to `.autopilot/lessons/` and decrements debt.
- [ ] Unit tests for the scoring fn; integration test for the lesson-save → debt-drop path.

## Blocked by
- ISSUE-005 (S3).
