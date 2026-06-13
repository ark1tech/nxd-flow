# Autopilot Demo

This demo is deterministic by default. It uses the scripted pilot so the product story is reliable offline;
`--live` can be used later to test Cursor SDK output.

## What the demo proves

Autopilot runs a stepped build loop for **Add authentication**:

1. A project-layout decision is covered by the demo profile and auto-decides.
2. The JWT-vs-sessions decision touches an auth boundary, is uncovered, and visibly pauses for a human.
3. The loop resumes after approval or override.
4. A decision pivot shows which nodes are invalidated and which are reused.
5. Saving a lesson marks a decision reviewed and drops comprehension debt.

## Headless verification

```bash
pnpm install
pnpm lint
pnpm test
pnpm demo:cli
pnpm verify
```

Expected checks:

| Check | Expected |
| --- | --- |
| Mission | `completed` |
| Decisions | project layout, auth strategy, auth persistence |
| Escalation | auth strategy escalates |
| Pivot | auth strategy invalidated, project layout reused |
| Lesson | a lesson markdown file is written and debt drops |

## UI walkthrough

1. Start the app:

   ```bash
   pnpm demo
   ```

2. Open `http://localhost:5173`.
3. Click **Start Mission** with `Add authentication`.
4. Watch the feed:
   - project-layout appears and auto-decides;
   - auth-strategy appears as `critical`;
   - the **Human checkpoint** panel appears.
5. Click **Approve JWT** or type `sessions` and click **Override**.
6. The remaining dependent decision streams in and the mission completes.
7. Click **Pivot** on the auth strategy node to see the compare payload.
8. Click **Save lesson** on a node; the debt score drops.

## Live mode

Set `CURSOR_API_KEY` and run:

```bash
pnpm autopilot -- mission "Add authentication" --live
```

The live path asks Cursor SDK for a decision. If the model does not emit Autopilot's expected JSON yet, the
runner falls back to the deterministic scripted decision so the loop stays demoable.

## Runtime state

The demo writes `.autopilot/` runtime state. This repository ignores that folder; reset it anytime with:

```bash
pnpm autopilot -- init
```
