import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AutopilotMode = "live" | "mock";

export interface AutopilotConfig {
  cursorApiKey?: string;
  mode: AutopilotMode;
  makerModel: string;
  auditorModel: string;
  port: number;
  stepDelayMs: number;
}

export function loadAutopilotConfig(root = process.cwd()): AutopilotConfig {
  loadDotEnv(root);
  const cursorApiKey = process.env.CURSOR_API_KEY;
  const requestedMode = process.env.AUTOPILOT_MODE;
  const mode: AutopilotMode = requestedMode === "mock" || requestedMode === "live" ? requestedMode : cursorApiKey ? "live" : "mock";
  return {
    cursorApiKey,
    mode,
    makerModel: process.env.AUTOPILOT_MAKER_MODEL ?? "composer-2.5",
    auditorModel: process.env.AUTOPILOT_AUDITOR_MODEL ?? "claude-4.6-sonnet-medium-thinking-1m",
    port: numberFromEnv("AUTOPILOT_PORT", 4317),
    stepDelayMs: numberFromEnv("AUTOPILOT_STEP_DELAY_MS", 450)
  };
}

function loadDotEnv(root: string): void {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function numberFromEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
