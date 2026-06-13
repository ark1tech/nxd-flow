# nxd-flow / Autopilot

Autopilot is a decision-first build loop: a stepped Pilot proposes decisions, the engine gates them with
grounded evidence, and a dashboard shows the live decision feed, debt score, and Decision DAG.

## Quick Start

```bash
pnpm install
pnpm test
pnpm lint
pnpm autopilot -- init
pnpm autopilot -- mission "Add authentication"
```

Run the local engine and dashboard:

```bash
pnpm demo
```

- Engine: `http://localhost:4317`
- Dashboard: `http://localhost:5173`

Headless demo and verification:

```bash
pnpm demo:cli
pnpm verify
```

See `DEMO.md` for the full walkthrough.

## Live Cursor SDK Runs

`pnpm verify` uses deterministic mock replay so CI is stable. Live missions load `CURSOR_API_KEY` from
`.env` (or the shell) and pass a real stdio MCP server inline to Cursor SDK agents:

```bash
pnpm autopilot -- mission "Add authentication" --live
```

If no key is available, Autopilot falls back to mock replay.

## Checkpoints

Missions run in isolated scratch repos under `.autopilot/worktrees/`. Every cleared Decision Node creates a
real commit checkpoint there; pivots create real git worktrees and compare changed files without mutating
this product repo.

## Docs

Start with `docs/README.md`, then read:

- `docs/prd/autopilot-mvp-v1.md`
- `docs/GLOSSARY.md`
- `docs/adr/0001...0008`
- `docs/issues/001...010`
