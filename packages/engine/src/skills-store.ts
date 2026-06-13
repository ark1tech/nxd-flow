import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillRole, SkillsSnapshot } from "@autopilot/shared";

const DEFAULT_SKILLS: Record<SkillRole, string> = {
  scoper: [
    "# Scoper skill",
    "",
    "Before planning, decide if the mission idea is underspecified.",
    "Ask clarifying questions only when key facts are missing (stack, scope, audience, constraints).",
    "Ask one question at a time. Do not ask about things already stated in the prompt."
  ].join("\n"),
  planner: [
    "# Planner skill",
    "",
    "Break the mission into 3-6 bounded steps.",
    "Each step must end with one consequential decision.",
    "Steps should match the user's actual request — do not default to unrelated auth fixtures."
  ].join("\n"),
  maker: [
    "# Maker skill",
    "",
    "Implement the current step in the scratch worktree.",
    "Propose exactly one decision with full options, pros, cons, and a comparative rationale.",
    "Mark your recommended choice in the JSON `choice` field."
  ].join("\n"),
  auditor: [
    "# Auditor skill",
    "",
    "Review proposed decisions for safety and defensibility.",
    "Flag only when the choice is unsafe, unknown, or contradicts profile rules."
  ].join("\n")
};

export class SkillsStore {
  constructor(private readonly skillsDir: string) {}

  ensureDefaults(): void {
    mkdirSync(this.skillsDir, { recursive: true });
    for (const role of Object.keys(DEFAULT_SKILLS) as SkillRole[]) {
      const path = this.pathFor(role);
      if (!existsSync(path)) writeFileSync(path, DEFAULT_SKILLS[role]);
    }
  }

  read(role: SkillRole): string {
    this.ensureDefaults();
    return readFileSync(this.pathFor(role), "utf8");
  }

  readAll(): SkillsSnapshot {
    return {
      planner: this.read("planner"),
      maker: this.read("maker"),
      auditor: this.read("auditor"),
      scoper: this.read("scoper")
    };
  }

  write(role: SkillRole, body: string): void {
    mkdirSync(this.skillsDir, { recursive: true });
    writeFileSync(this.pathFor(role), body);
  }

  private pathFor(role: SkillRole): string {
    return join(this.skillsDir, `${role}.md`);
  }
}
