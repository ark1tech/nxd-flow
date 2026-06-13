# ADR-0001 — Execution substrate: Cursor SDK, TypeScript, local runtime

- Status: Accepted
- Date: 2026-06-13
- Related: PRD `docs/prd/autopilot-mvp-v1.md`

## Context

Autopilot's orchestrator must programmatically drive agents through plan → decide → implement → handoff,
inject the `.autopilot` state as MCP tools, stream events to a dashboard, resume work across a loop
heartbeat, and run each branch against an isolated git worktree. The repo is greenfield (no language or
framework committed). The maker/checker split requires running two agents with different models.

Options considered:
- **Cursor SDK** (`@cursor/sdk` TS / `cursor-sdk` Python) — programmatic `Agent` runs, inline MCP servers,
  streaming, `resume` across process boundaries, local runtime against a `cwd`.
- **Cursor CLI headless** (`cursor-agent`) — shell out per step, parse output. Thinner, more glue, weaker
  structured streaming/lifecycle.
- **Pure in-editor** (skills + subagents + hooks only) — no external daemon/heartbeat; clunky worktree and
  dashboard control.
- **Multi-backend abstraction** (SDK + Claude Code + Codex) — portable but premature.

## Decision

Use the **Cursor SDK, TypeScript variant (`@cursor/sdk`)**, on the **local runtime** (`local: { cwd }`).

- Each Mission/branch runs against a real git worktree (a `cwd`) on the user's machine. For v1 this `cwd`
  is an isolated scratch repo under `.autopilot/worktrees/`, not the Autopilot tool repo itself (ADR-0008).
- Maker and checker are two SDK `Agent`s with different models.
- Missions use `Agent.create` / `agent.send` for durable multi-turn runs; `Agent.resume` continues across
  the heartbeat. The `.autopilot` MCP server is passed **inline** on every `create`/`send`/`resume`
  (inline servers are not persisted across resume).
- TypeScript is chosen so the engine, MCP server, and web dashboard share one language and one set of
  Decision Node / DAG / Profile types end-to-end.

## Consequences

- Positive: purpose-built API for exactly this orchestration shape; local worktrees make the
  "watch two architectures grow side-by-side" demo literal; one-language stack; greenfield = zero migration.
- Negative / watch-outs: SDK is public beta (surface may evolve); must always set `local` explicitly (the
  SDK silently defaults to local), always `wait()` on runs, always dispose agents, and distinguish thrown
  `CursorAgentError` (never started) from `result.status === "error"` (started, failed).
- Deferred: cloud runtime (hosted VMs, `autoCreatePR`) and non-Cursor backends are out of scope for v1.
