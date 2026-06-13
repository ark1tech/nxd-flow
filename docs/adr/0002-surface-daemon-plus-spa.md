# ADR-0002 — Surface architecture: standalone daemon + SPA over WS/REST

- Status: Accepted
- Date: 2026-06-13
- Related: ADR-0001, PRD `docs/prd/autopilot-mvp-v1.md`

## Context

The engine is long-running and stateful: it holds live SDK agent handles, the in-flight Decision DAG,
worktrees, and the loop heartbeat. The dashboard must show decisions appearing in real time (onboarding
feed, DAG visualizer, debt meter, branch compare), not laggy polling.

Options considered:
- **Standalone Node/TS daemon + Vite/React SPA** over WebSocket (stream) + REST (actions).
- **Next.js full-stack** single app — awkward fit for a stateful, agent-holding long-running process;
  ends up needing a custom server anyway.
- **Static files + polling** — simplest, but no live streaming; kills the real-time demo.

## Decision

Build a **standalone Node/TS orchestrator daemon** that owns the loop, DAG, worktrees, heartbeat, and SDK
agent handles, exposing:
- **WebSocket** — live decision/agent-event stream to the dashboard.
- **REST** — actions: start/stop mission, branch/pivot, review/pay-debt, set override-scope.

The **dashboard** is a **Vite + React + Tailwind** SPA (thin client). The Decision DAG is rendered with
**React Flow**.

## Consequences

- Positive: clean separation (framework-agnostic engine, replaceable UI); the stateful daemon model fits
  naturally; real-time UX out of the box.
- Negative / watch-outs: two processes to run in dev; need a WS reconnection/backfill strategy so a
  reconnecting dashboard can catch up on missed events (the SQLite index is the backfill source).
