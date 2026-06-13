# ISSUE-005 (S3) — Full serial Mission: plan → decide → implement → handoff

- Type: AFK
- Triage: ready-for-agent
- User stories: 5, 6, 7, 15, 16
- Refs: ADR-0004 (one commit per node), ADR-0005, ADR-0006 (stepped), `docs/GLOSSARY.md`,
  `docs/prd/autopilot-mvp-v1.md`

## Context (read first)
This grows the walking skeleton into a real Mission that ships working code on the **TS fixture** (a small
Fastify/Express REST service under `fixtures/`; demo Mission = "add authentication"). It runs the full
stepped pipeline, every consequential decision flowing through the gate, and produces the Decision DAG with
**one git commit per Decision Node** (required later for commit-replay pivots).

## What to build
Thicken the stepped `LoopEngine` to run the pipeline stages: produce architecture + `glossary/PROJECT.md`;
generate PRD + ADRs for the feature; split into issues; implement issues **serially**; write a handoff doc
per issue (deviations, self-made decisions, tradeoffs) to `missions/<id>/`. Each step proposes its
decision(s) → `DecisionGate` (ISSUE-003) → on `decide`, the engine commits the step's work as one commit
linked to the Decision Node (the Checkpoint). Record declared dependencies (`cite_dependencies`).

## Acceptance criteria
- [ ] A small fixture TS service exists under `fixtures/`; a Mission "add authentication" runs end-to-end.
- [ ] The Mission produces architecture, PRD/ADRs, issues, committed working code, and per-issue handoff docs.
- [ ] Every consequential decision passes through the gate; exactly one well-justified escalation occurs on a
      seeded high-tier, uncovered decision; covered ones don't escalate.
- [ ] One git commit per Decision Node (Checkpoint), linked in `DecisionStore`.
- [ ] Integration test on a tiny fixture idea asserts the above artifacts + commit-per-node invariant.

## Blocked by
- ISSUE-003 (S2b).
