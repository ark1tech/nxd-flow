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

By default the MVP uses a deterministic mock `AgentRunner` so tests and demos run offline. To ask the Cursor
SDK to produce a step result, set `CURSOR_API_KEY` and pass `--live`:

```bash
CURSOR_API_KEY=cursor_... pnpm autopilot -- mission "Add authentication" --live
```

If the model does not emit Autopilot's decision JSON yet, the runner falls back to a deterministic decision
so the loop remains demoable while prompts mature.

## Checkpoints

Local mission runs use pseudo-checkpoints by default so development smoke tests do **not** create git
commits. Real commit checkpoints are opt-in:

```bash
AUTOPILOT_ENABLE_GIT_CHECKPOINTS=1 pnpm autopilot -- mission "Add authentication"
```

Pivoting requires real checkpoints because it uses git worktrees and commit replay.

## Docs

Start with `docs/README.md`, then read:

- `docs/prd/autopilot-mvp-v1.md`
- `docs/GLOSSARY.md`
- `docs/adr/0001...0007`
- `docs/issues/001...010`
