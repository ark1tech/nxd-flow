import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface AutopilotPaths {
  root: string;
  autopilot: string;
  db: string;
  policy: string;
  profile: string;
  profileHistory: string;
  glossary: string;
  architecture: string;
  decisions: string;
  missions: string;
  lessons: string;
  knowledge: string;
  memory: string;
  worktrees: string;
  skills: string;
}

export function resolveWorkspaceRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "fixtures", "ts-service"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(start);
}

export function resolveMissionSourceForIdea(workspaceRoot: string, idea: string): string {
  const apiFixture = join(workspaceRoot, "fixtures", "ts-service");
  const webFixture = join(workspaceRoot, "fixtures", "web-app");
  const apiLike = /\b(auth|api|jwt|session|login|backend|fastify|endpoint|bearer)\b/i.test(idea);
  const webLike = /\b(website|web app|frontend|dating|bumble|tinder|landing|portfolio|blog|react|next|vite|html|css)\b/i.test(idea);
  if (webLike && !apiLike && existsSync(webFixture)) return webFixture;
  if (existsSync(apiFixture)) return apiFixture;
  if (existsSync(webFixture)) return webFixture;
  return workspaceRoot;
}

export function resolveMissionSource(root = process.cwd()): string {
  const workspaceRoot = resolveWorkspaceRoot(root);
  return resolveMissionSourceForIdea(workspaceRoot, "");
}

export function resolvePaths(root = process.cwd()): AutopilotPaths {
  const workspaceRoot = resolveWorkspaceRoot(root);
  const autopilot = join(workspaceRoot, ".autopilot");
  return {
    root: workspaceRoot,
    autopilot,
    db: join(autopilot, "state.sqlite"),
    policy: join(autopilot, "policy", "blast-radius.yml"),
    profile: join(autopilot, "pilot", "PROFILE.md"),
    profileHistory: join(autopilot, "pilot", "profile-history"),
    glossary: join(autopilot, "glossary", "PROJECT.md"),
    architecture: join(autopilot, "architecture"),
    decisions: join(autopilot, "decisions"),
    missions: join(autopilot, "missions"),
    lessons: join(autopilot, "lessons"),
    knowledge: join(autopilot, "knowledge", "PROJECT.md"),
    memory: join(autopilot, "memory"),
    worktrees: join(autopilot, "worktrees"),
    skills: join(autopilot, "skills")
  };
}

export function ensureAutopilotLayout(root = process.cwd()): AutopilotPaths {
  const paths = resolvePaths(root);
  for (const dir of [
    paths.autopilot,
    join(paths.autopilot, "policy"),
    join(paths.autopilot, "pilot"),
    paths.profileHistory,
    join(paths.autopilot, "glossary"),
    paths.architecture,
    paths.decisions,
    paths.missions,
    paths.lessons,
    join(paths.autopilot, "knowledge"),
    paths.memory,
    paths.worktrees,
    paths.skills
  ]) {
    mkdirSync(dir, { recursive: true });
  }

  writeIfMissing(
    paths.profile,
    [
      "# Pilot Profile",
      "",
      "## Rules",
      "",
      "- Keep route handlers inside the existing Fastify fixture layout so the product remains easy to inspect.",
      "- Prefer an in-memory fixture user store unless the mission explicitly needs database behavior.",
      ""
    ].join("\n")
  );
  writeIfMissing(paths.glossary, "# Project Glossary\n\n");
  writeIfMissing(paths.knowledge, "# Project Knowledge\n\n");
  writeIfMissing(
    paths.policy,
    [
      "tiers:",
      "  schema: high",
      "  public-api: high",
      "  auth-security: critical",
      "  money: critical",
      "  data-lifecycle: critical",
      "  foundational-dependency: high",
      "  cross-cutting: medium",
      "  project: low",
      "overrides: []",
      ""
    ].join("\n")
  );
  return paths;
}

function writeIfMissing(path: string, contents: string): void {
  if (!existsSync(path)) {
    writeFileSync(path, contents);
  }
}
