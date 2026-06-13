import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { FileGraphEdge, FileGraphNode, FileGraphSnapshot, WorktreeEntry, WorktreeFileStatus, WorktreeSnapshot } from "@autopilot/shared";

const IGNORE_NAMES = new Set(["node_modules", ".git", "dist", ".DS_Store", "tsconfig.tsbuildinfo"]);

export class WorktreeManager {
  private scratchRoot?: string;

  constructor(
    private readonly sourceRoot: string,
    private readonly worktreeRoot: string
  ) {}

  createScratchRepo(missionId: string): string {
    const scratch = join(this.worktreeRoot, "scratch", missionId);
    rmSync(scratch, { recursive: true, force: true });
    mkdirSync(scratch, { recursive: true });
    this.copySourceInto(scratch);
    this.copyWorkspaceTsconfigBase();
    this.linkDependenciesIfAvailable(scratch);
    writeFileSync(join(scratch, ".gitignore"), "node_modules/\ndist/\n");
    this.writeFixtureVitestConfig(scratch);
    this.git(["init"], scratch);
    this.git(["add", "."], scratch);
    this.git(["commit", "--allow-empty", "-m", "autopilot scratch base"], scratch);
    this.scratchRoot = scratch;
    return scratch;
  }

  checkpoint(label: string, cwd = this.mustScratchRoot()): string {
    this.git(["add", "."], cwd);
    try {
      this.git(["commit", "-m", `autopilot checkpoint: ${label}`], cwd);
    } catch {
      // No changes is still a valid checkpoint for planning-only nodes.
    }
    return this.git(["rev-parse", "HEAD"], cwd).trim();
  }

  fork(label: string, commitSha: string, cwd = this.mustScratchRoot()): string {
    mkdirSync(this.worktreeRoot, { recursive: true });
    const path = join(this.worktreeRoot, "branches", label);
    rmSync(path, { recursive: true, force: true });
    this.git(["worktree", "add", "-B", `autopilot/${label}`, path, commitSha], cwd);
    return path;
  }

  replayCommit(commitSha: string, cwd = this.mustScratchRoot()): void {
    this.git(["cherry-pick", commitSha], cwd);
  }

  compare(left: string, right: string, cwd = this.mustScratchRoot()): string {
    return this.git(["diff", "--stat", left, right], cwd);
  }

  workingDiffStat(cwd = this.mustScratchRoot()): string {
    return this.git(["diff", "--stat", "HEAD"], cwd);
  }

  hasCommit(commitSha: string, cwd = this.mustScratchRoot()): boolean {
    try {
      this.git(["merge-base", "--is-ancestor", commitSha, "HEAD"], cwd);
      return true;
    } catch {
      return false;
    }
  }

  changedFiles(commitSha: string, cwd = this.mustScratchRoot()): string[] {
    return this.git(["diff-tree", "--no-commit-id", "--name-only", "-r", commitSha], cwd)
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  }

  changedFilesSinceHead(cwd = this.mustScratchRoot()): string[] {
    return this.git(["status", "--short", "--untracked-files=all"], cwd)
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.slice(3).trim())
      .sort();
  }

  scratchPathFor(missionId: string): string | undefined {
    const scratch = join(this.worktreeRoot, "scratch", missionId);
    return existsSync(scratch) ? scratch : undefined;
  }

  displayPathFor(absolutePath: string): string {
    const rel = relative(process.cwd(), absolutePath);
    return rel.startsWith("..") ? absolutePath : rel;
  }

  headSha(cwd: string): string | undefined {
    if (!existsSync(join(cwd, ".git"))) return undefined;
    try {
      return this.git(["rev-parse", "--short", "HEAD"], cwd).trim();
    } catch {
      return undefined;
    }
  }

  fileStatuses(cwd: string): Map<string, WorktreeFileStatus> {
    const statuses = new Map<string, WorktreeFileStatus>();
    if (!existsSync(join(cwd, ".git"))) return statuses;
    const output = this.git(["status", "--porcelain", "--untracked-files=all"], cwd);
    for (const line of output.split("\n")) {
      if (!line.trim()) continue;
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (code.includes("D")) statuses.set(file, "deleted");
      else if (code.includes("A") || code.includes("?")) statuses.set(file, code.includes("?") ? "untracked" : "added");
      else statuses.set(file, "modified");
    }
    return statuses;
  }

  listTree(cwd: string, maxDepth = 4): WorktreeEntry[] {
    if (!existsSync(cwd)) return [];
    const statuses = this.fileStatuses(cwd);
    return this.readDirEntries(cwd, cwd, statuses, maxDepth);
  }

  readWorktreeFile(cwd: string, relativePath: string): { path: string; content: string; language: string } {
    const normalized = relativePath.replace(/^\/+/, "");
    const absolute = resolve(cwd, normalized);
    if (!absolute.startsWith(resolve(cwd))) throw new Error("Path escapes worktree root");
    if (!existsSync(absolute) || statSync(absolute).isDirectory()) throw new Error("File not found");
    return {
      path: normalized,
      content: readFileSync(absolute, "utf8"),
      language: languageForFile(normalized)
    };
  }

  buildSnapshot(input: {
    missionId: string;
    root: string;
    branchId?: string;
    branchLabel?: string;
  }): WorktreeSnapshot {
    const changedFiles = existsSync(input.root) ? this.changedFilesSinceHead(input.root) : [];
    return {
      missionId: input.missionId,
      root: input.root,
      displayPath: this.displayPathFor(input.root),
      branchId: input.branchId,
      branchLabel: input.branchLabel,
      headSha: this.headSha(input.root),
      changedFiles,
      entries: this.listTree(input.root)
    };
  }

  buildFileGraph(root: string, changedByDecision: Map<string, string> = new Map()): FileGraphSnapshot {
    const statuses = this.fileStatuses(root);
    const files = new Map<string, FileGraphNode>();
    const imports: FileGraphEdge[] = [];

    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir)) {
        if (IGNORE_NAMES.has(name)) continue;
        const absolute = join(dir, name);
        const rel = relative(root, absolute).split("\\").join("/");
        const stat = statSync(absolute);
        if (stat.isDirectory()) {
          walk(absolute);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(name)) continue;
        if (isIgnoredGraphFile(rel, name)) continue;
        const status = statuses.get(rel);
        const nodeStatus = status === "added" || status === "untracked" ? status : status === "modified" ? "modified" : "unchanged";
        files.set(rel, {
          path: rel,
          status: nodeStatus,
          lastChangedByDecisionId: changedByDecision.get(rel)
        });
        for (const target of extractImports(readFileSync(absolute, "utf8"), rel)) {
          if (files.has(target) || target.endsWith(".ts") || target.endsWith(".tsx")) {
            imports.push({ from: rel, to: target });
          }
        }
      }
    };

    walk(root);
    for (const target of imports.map((edge) => edge.to)) {
      if (!files.has(target) && target.startsWith("src/") && !isIgnoredGraphFile(target, target.split("/").pop() ?? target)) {
        files.set(target, { path: target, status: "unchanged", lastChangedByDecisionId: changedByDecision.get(target) });
      }
    }

    const connected = connectedGraphPaths(files, imports);
    const filteredFiles = [...files.values()].filter((file) => connected.has(file.path));
    const filteredImports = imports.filter((edge) => connected.has(edge.from) && connected.has(edge.to));

    return {
      missionId: "",
      files: filteredFiles.sort((a, b) => a.path.localeCompare(b.path)),
      imports: filteredImports
    };
  }

  private readDirEntries(
    root: string,
    dir: string,
    statuses: Map<string, WorktreeFileStatus>,
    depth: number
  ): WorktreeEntry[] {
    if (depth <= 0) return [];
    const entries: WorktreeEntry[] = [];
    for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
      if (IGNORE_NAMES.has(name)) continue;
      const absolute = join(dir, name);
      const path = relative(root, absolute).split("\\").join("/");
      const stat = statSync(absolute);
      if (stat.isDirectory()) {
        entries.push({
          name,
          path,
          kind: "directory",
          children: this.readDirEntries(root, absolute, statuses, depth - 1)
        });
        continue;
      }
      entries.push({
        name,
        path,
        kind: "file",
        status: statuses.get(path)
      });
    }
    return entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private mustScratchRoot(): string {
    if (!this.scratchRoot) throw new Error("Scratch repository has not been created for this mission");
    return this.scratchRoot;
  }

  private copySourceInto(destination: string): void {
    for (const entry of readdirSync(this.sourceRoot)) {
      if (entry === ".git" || entry === ".autopilot" || entry === "node_modules" || entry === "dist") continue;
      cpSync(join(this.sourceRoot, entry), join(destination, entry), {
        recursive: true,
        filter: (source) => !source.includes("/node_modules/") && !source.includes("/.git/") && !source.includes("/.autopilot/")
      });
    }
  }

  private copyWorkspaceTsconfigBase(): void {
    const candidate = resolve(this.sourceRoot, "..", "..", "tsconfig.base.json");
    if (existsSync(candidate)) {
      mkdirSync(this.worktreeRoot, { recursive: true });
      cpSync(candidate, join(this.worktreeRoot, "tsconfig.base.json"));
    }
    const packageBase = resolve(dirname(this.sourceRoot), "tsconfig.base.json");
    if (existsSync(packageBase)) cpSync(packageBase, join(this.worktreeRoot, "tsconfig.base.json"));
  }

  private linkDependenciesIfAvailable(cwd: string): void {
    const sourceModules = join(this.sourceRoot, "node_modules");
    if (!existsSync(sourceModules) || existsSync(join(cwd, "node_modules"))) return;
    symlinkSync(sourceModules, join(cwd, "node_modules"), "dir");
  }

  private writeFixtureVitestConfig(cwd: string): void {
    if (!existsSync(join(cwd, "package.json"))) return;
    writeFileSync(
      join(cwd, "vitest.config.ts"),
      [
        'import { defineConfig } from "vitest/config";',
        "",
        "export default defineConfig({",
        "  test: { include: [\"src/**/*.test.ts\"], testTimeout: 30000 }",
        "});",
        ""
      ].join("\n")
    );
  }

  private git(args: string[], cwd: string): string {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "Autopilot",
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? "autopilot@example.local",
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? "Autopilot",
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? "autopilot@example.local"
      }
    });
  }
}

function languageForFile(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
}

function extractImports(source: string, fromPath: string): string[] {
  const targets = new Set<string>();
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const raw = match[1];
      if (!raw || raw.startsWith(".") === false) continue;
      targets.add(resolveImportPath(fromPath, raw));
    }
  }
  return [...targets];
}

function resolveImportPath(fromPath: string, importPath: string): string {
  const parts = dirname(fromPath).split("/").filter(Boolean);
  for (const segment of importPath.split("/")) {
    if (segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  let resolved = parts.join("/");
  if (!/\.(ts|tsx|js|jsx)$/.test(resolved)) resolved += ".ts";
  return resolved;
}

function isIgnoredGraphFile(path: string, name: string): boolean {
  if (/\.test\.(ts|tsx|js|jsx)$/.test(name)) return true;
  if (/\.config\.(ts|js|mjs|cjs)$/.test(name)) return true;
  if (name.startsWith("vitest.config") || name.startsWith("tsconfig")) return true;
  if (/^packages\/engine\//.test(path)) return true;
  return false;
}

function connectedGraphPaths(files: Map<string, FileGraphNode>, imports: FileGraphEdge[]): Set<string> {
  const changed = new Set(
    [...files.entries()].filter(([, node]) => node.status !== "unchanged").map(([path]) => path)
  );
  const connected = new Set(changed);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const edge of imports) {
      if (connected.has(edge.from) && files.has(edge.to) && !connected.has(edge.to)) {
        connected.add(edge.to);
        expanded = true;
      }
      if (connected.has(edge.to) && files.has(edge.from) && !connected.has(edge.from)) {
        connected.add(edge.from);
        expanded = true;
      }
    }
  }
  return connected;
}
