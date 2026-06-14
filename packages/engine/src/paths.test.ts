import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMissionSourceForIdea, resolveWorkspaceRoot } from "./paths.js";

describe("paths", () => {
  it("walks up to the monorepo root that contains fixtures", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-paths-"));
    const monorepo = join(dir, "repo");
    mkdirSync(join(monorepo, "fixtures", "ts-service"), { recursive: true });
    mkdirSync(join(monorepo, "fixtures", "web-app"), { recursive: true });
    writeFileSync(join(monorepo, "fixtures", "ts-service", "package.json"), "{}");
    writeFileSync(join(monorepo, "fixtures", "web-app", "package.json"), "{}");
    const nested = join(monorepo, "packages", "engine");

    expect(resolveWorkspaceRoot(nested)).toBe(monorepo);
    rmSync(dir, { recursive: true, force: true });
  });

  it("picks web fixture for frontend missions and api fixture for auth missions", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-paths-"));
    const monorepo = join(dir, "repo");
    mkdirSync(join(monorepo, "fixtures", "ts-service"), { recursive: true });
    mkdirSync(join(monorepo, "fixtures", "web-app"), { recursive: true });
    writeFileSync(join(monorepo, "fixtures", "ts-service", "package.json"), "{}");
    writeFileSync(join(monorepo, "fixtures", "web-app", "package.json"), "{}");

    expect(resolveMissionSourceForIdea(monorepo, "Build me a dating web app like Bumble")).toBe(join(monorepo, "fixtures", "web-app"));
    expect(resolveMissionSourceForIdea(monorepo, "Add authentication to the API")).toBe(join(monorepo, "fixtures", "ts-service"));
    rmSync(dir, { recursive: true, force: true });
  });
});
