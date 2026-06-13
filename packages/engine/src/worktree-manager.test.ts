import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorktreeManager } from "./worktree-manager.js";

describe("WorktreeManager", () => {
  it("creates an isolated scratch repository and checkpoints real commits", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-worktree-"));
    const source = join(dir, "fixture");
    const work = join(dir, "work");
    writeFixture(source);
    const manager = new WorktreeManager(source, work);

    const scratch = manager.createScratchRepo("mission-1");
    writeFileSync(join(scratch, "server.ts"), "export const answer = 42;\n");
    expect(manager.changedFilesSinceHead(scratch)).toEqual(["server.ts"]);
    const checkpoint = manager.checkpoint("decision-1", scratch);

    expect(checkpoint).not.toMatch(/^pseudo-/);
    expect(readFileSync(join(source, "server.ts"), "utf8")).toBe("export const answer = 1;\n");
    expect(manager.changedFiles(checkpoint, scratch)).toEqual(["server.ts"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("forks from a checkpoint and replays an independent commit", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-worktree-"));
    const source = join(dir, "fixture");
    const work = join(dir, "work");
    writeFixture(source);
    const manager = new WorktreeManager(source, work);
    const scratch = manager.createScratchRepo("mission-2");
    writeFileSync(join(scratch, "server.ts"), "export const answer = 2;\n");
    const first = manager.checkpoint("decision-1", scratch);
    writeFileSync(join(scratch, "readme.md"), "reused\n");
    const second = manager.checkpoint("decision-2", scratch);

    const branch = manager.fork("mission-2-branch", first);
    manager.replayCommit(second, branch);

    expect(existsSync(join(branch, "readme.md"))).toBe(true);
    expect(readFileSync(join(branch, "server.ts"), "utf8")).toBe("export const answer = 2;\n");
    rmSync(dir, { recursive: true, force: true });
  });
});

function writeFixture(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "server.ts"), "export const answer = 1;\n", { flag: "w" });
}
