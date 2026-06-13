import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAutopilotConfig } from "./config.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadAutopilotConfig", () => {
  it("loads CURSOR_API_KEY and defaults from a workspace .env file", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-config-"));
    writeFileSync(join(dir, ".env"), "CURSOR_API_KEY=crsr_test_key\nAUTOPILOT_STEP_DELAY_MS=10\n");
    delete process.env.CURSOR_API_KEY;
    delete process.env.AUTOPILOT_MODE;

    const config = loadAutopilotConfig(dir);

    expect(config.cursorApiKey).toBe("crsr_test_key");
    expect(config.mode).toBe("live");
    expect(config.makerModel).toBe("composer-2.5");
    expect(config.stepDelayMs).toBe(10);
    rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to mock mode when no Cursor API key is available", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-config-"));
    delete process.env.CURSOR_API_KEY;
    delete process.env.AUTOPILOT_MODE;

    const config = loadAutopilotConfig(dir);

    expect(config.mode).toBe("mock");
    rmSync(dir, { recursive: true, force: true });
  });
});
