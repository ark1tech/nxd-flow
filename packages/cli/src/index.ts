#!/usr/bin/env node
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createAutopilot, ensureAutopilotLayout } from "@autopilot/engine";

const workspaceRoot = process.env.INIT_CWD ?? process.cwd();
const [command, ...args] = process.argv.slice(2).filter((arg) => arg !== "--");

if (!command || command === "help") {
  console.log("Usage: autopilot init | start [port] | mission <idea> [--live] | demo | verify");
  process.exit(0);
}

if (command === "init") {
  ensureAutopilotLayout(workspaceRoot);
  console.log("Initialized .autopilot/");
  process.exit(0);
}

if (command === "start") {
  const port = Number(args[0] ?? process.env.AUTOPILOT_PORT ?? 4317);
  const { gateway } = createAutopilot(workspaceRoot);
  gateway.listen(port);
  console.log(`Autopilot engine listening on http://localhost:${port}`);
} else if (command === "mission") {
  const live = args.includes("--live");
  const idea = args.filter((arg) => arg !== "--live").join(" ") || "Build a feature";
  const { store, engine } = createAutopilot(workspaceRoot);
  const result = await engine.startMission(idea, { live });
  console.log(JSON.stringify(result, null, 2));
  store.close();
} else if (command === "demo" || command === "verify") {
  rmSync(join(workspaceRoot, ".autopilot"), { recursive: true, force: true });
  const { store, engine } = createAutopilot(workspaceRoot);
  const result = await engine.startMission("Add authentication", { autoAnswer: true });
  const authDecision = result.decisions.find((decision) => decision.question.includes("JWT or sessions"));
  if (!authDecision) throw new Error("Demo did not produce the auth strategy decision");
  const pivot = await engine.pivot(authDecision.id, "sessions");
  const lessonPath = engine.saveLesson(authDecision.id);
  const events = store.listEvents();
  const escalated = events.some((event) => event.type === "gate.escalated");
  const summary = {
    mission: result.mission.status,
    decisions: result.decisions.map((decision) => ({ id: decision.id, question: decision.question, tier: decision.tier, choice: decision.choice })),
    escalated,
    pivot: { invalidated: pivot.invalidated, reused: pivot.reused, changed: pivot.compare.changed },
    lessonPath
  };
  if (command === "verify") {
    if (result.mission.status !== "completed") throw new Error("Mission did not complete");
    if (!escalated) throw new Error("Expected auth strategy escalation");
    if (!pivot.reused.length) throw new Error("Expected pivot to reuse at least one decision");
    if (!pivot.invalidated.includes(authDecision.id)) throw new Error("Expected pivot to invalidate the auth decision");
    console.log("Autopilot verification passed");
  }
  console.log(JSON.stringify(summary, null, 2));
  store.close();
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
