# Autopilot Demo

This demo is deterministic in `pnpm verify` and live-capable with the **Live SDK** toggle in the dashboard
or `--live` on the CLI. The baseline uses real scratch git repos, checkpoint commits, worktree pivots with
live branch reruns, a stdio MCP server, and the fixture's typecheck/test gate.

## What the demo proves

Autopilot runs a plan-first stepped build loop:

1. A planning run turns your prompt into 3–6 bounded steps.
2. Each step proposes one consequential decision; the DAG grows live with pending-node activity.
3. High-blast-radius uncovered decisions pause for a human checkpoint.
4. A pivot forks an isolated worktree, re-runs only invalidated downstream steps, and compares original vs branch.
5. Saving a lesson marks a decision reviewed and drops comprehension debt.

## Headless verification

```bash
pnpm install
pnpm lint
pnpm test
pnpm demo:cli
pnpm verify
```

## UI walkthrough

1. Start the app:

   ```bash
   pnpm demo
   ```

2. Open `http://localhost:5173`.
3. Type a feature in the left **Prompt** panel (e.g. `Add authentication`).
4. Leave **Live SDK** checked for real Cursor runs (requires `CURSOR_API_KEY` in `.env`), or uncheck for the deterministic mock path.
5. Click **Run Autopilot**.
6. Watch the hero **Decision DAG** grow: pending nodes pulse while the Pilot works; the feed streams coarse activity.
7. If an escalation fires, use the right **Inspector** to Approve or Override with a learning scope.
8. After completion, select a decision on the DAG, enter a new choice, and click **Branch** to pivot.
9. The canvas splits into **Original | Branch** with changed nodes highlighted; the inspector shows the worktree diff.

## Live mode

Set `CURSOR_API_KEY` in `.env` and run with **Live SDK** enabled in the dashboard, or:

```bash
pnpm autopilot -- mission "Add authentication" --live
```

The live path uses Cursor SDK `Agent.create` → `send` → `run.stream()` → `wait()` with inline MCP (`autopilot-mcp`).
Without a key, uncheck **Live SDK** or use `pnpm verify` for the deterministic mock path.

## Runtime state

The demo writes `.autopilot/` runtime state, including scratch repos and pivot worktrees. Reset anytime:

```bash
rm -rf .autopilot && pnpm autopilot -- init
```
