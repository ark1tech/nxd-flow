import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export class WorktreeManager {
  constructor(
    private readonly repoRoot: string,
    private readonly worktreeRoot: string
  ) {}

  checkpoint(label: string): string {
    if (process.env.AUTOPILOT_ENABLE_GIT_CHECKPOINTS !== "1") {
      return `pseudo-${label}-${Date.now()}`;
    }
    this.git(["add", "."]);
    try {
      this.git(["commit", "-m", `autopilot checkpoint: ${label}`]);
    } catch {
      // No changes is still a valid checkpoint for planning-only nodes.
    }
    return this.git(["rev-parse", "HEAD"]).trim();
  }

  fork(label: string, commitSha: string): string {
    if (commitSha.startsWith("pseudo-")) {
      throw new Error("Real git checkpoints are disabled. Set AUTOPILOT_ENABLE_GIT_CHECKPOINTS=1 before pivoting.");
    }
    mkdirSync(this.worktreeRoot, { recursive: true });
    const path = join(this.worktreeRoot, label);
    this.git(["worktree", "add", "-B", `autopilot/${label}`, path, commitSha]);
    return path;
  }

  replayCommit(commitSha: string, cwd = this.repoRoot): void {
    execFileSync("git", ["cherry-pick", commitSha], { cwd, stdio: "pipe" });
  }

  compare(left: string, right: string): string {
    return execFileSync("git", ["diff", "--stat", left, right], { cwd: this.repoRoot, encoding: "utf8" });
  }

  private git(args: string[]): string {
    return execFileSync("git", args, { cwd: this.repoRoot, encoding: "utf8", stdio: "pipe" });
  }
}
