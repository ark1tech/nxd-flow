# ISSUE-001 (S1) — Walking skeleton: idea → one proposed decision → live feed

- Type: AFK
- Triage: ready-for-agent
- User stories: 1, 5, 6, 17, 34, 35
- Refs: ADR-0001 (Cursor SDK/local/TS), ADR-0002 (daemon+SPA), ADR-0003 (state), ADR-0006 (stepped loop),
  `docs/GLOSSARY.md`

## Context (read first)
Autopilot is an autonomous build loop where a **Pilot** agent runs ahead of the human while the human stays
in command (see `docs/GLOSSARY.md`, `docs/prd/autopilot-mvp-v1.md`). This slice is the **tracer bullet**: it
proves every layer connects end-to-end with the thinnest possible sliver of each module. No grounding,
escalation, or code-gen yet — just: a rough idea starts a Mission, the orchestrator runs ONE bounded Pilot
step that **proposes** a single Decision Node via MCP, and that decision streams live into the dashboard.

## What to build
An end-to-end path through: monorepo scaffold (`engine`, `mcp`, `dashboard`, `shared` packages) →
`autopilot init` creating the `.autopilot/` layout + SQLite `DecisionStore` (just enough schema for nodes) →
`AutopilotMcpServer` with a working `propose_decision` tool → `AgentRunner` wrapping `@cursor/sdk` (local
runtime, one bounded `Agent.send`, inline MCP) → a minimal **stepped** `LoopEngine.startMission({idea})`
that runs one step whose prompt instructs the Pilot to propose exactly one consequential decision →
`DashboardGateway` (WebSocket) → a Vite+React SPA that shows a live **onboarding feed** with that decision
(question, options, choice, rationale).

Establish the Vitest harness here and write the first unit test (the `DecisionStore` node round-trip) to set
the pattern later slices mirror.

## Acceptance criteria
- [ ] `pnpm` (or npm) workspace with `engine`, `mcp`, `dashboard`, `shared`; `@autopilot/shared` exports
      `DecisionNode`, `Edge`, `BlastRadiusTier`, `Surface`, `Mission` types.
- [ ] `autopilot init` is idempotent and creates the `.autopilot/` layout (ADR-0003) incl. an empty SQLite DB.
- [ ] Starting a Mission with an idea string launches one bounded Pilot run via the SDK (local runtime,
      explicit `local: { cwd }`, `wait()`ed, disposed; `CursorAgentError` vs `result.status==="error"`
      distinguished per ADR-0001).
- [ ] The Pilot calls `propose_decision` and the node is persisted in `DecisionStore`.
- [ ] The decision streams over WebSocket and renders in the dashboard feed in real time.
- [ ] Vitest runs; `DecisionStore` node round-trip test passes.
- [ ] README documents how to run engine + dashboard in dev.

## Blocked by
- None — can start immediately.
