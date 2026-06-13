import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { nanoid } from "nanoid";
import type { DecisionNode, ProfileRule } from "@autopilot/shared";

export class ProfileStore {
  constructor(
    private readonly profilePath: string,
    private readonly historyDir: string
  ) {}

  effectiveRules(): ProfileRule[] {
    if (!existsSync(this.profilePath)) return [];
    const content = readFileSync(this.profilePath, "utf8");
    return content
      .split("\n")
      .filter((line) => line.trim().startsWith("- "))
      .map((line, index) => ({
        id: `profile_${index}`,
        scope: "global",
        text: line.replace(/^- /, "").trim(),
        weight: 1,
        provisional: false
      }));
  }

  coverageFor(decision: Pick<DecisionNode, "question" | "rationale" | "choice">): { status: "covered" | "uncovered"; evidence: string[] } {
    const text = `${decision.question} ${decision.choice} ${decision.rationale}`.toLowerCase();
    const evidence = this.effectiveRules()
      .filter((rule) => words(rule.text).filter((word) => text.includes(word)).length >= 2)
      .map((rule) => rule.text);
    return evidence.length > 0 ? { status: "covered", evidence } : { status: "uncovered", evidence: [] };
  }

  seedFromOnboarding(answers: string[]): void {
    mkdirSync(dirname(this.profilePath), { recursive: true });
    const content = ["# Pilot Profile", "", "## Rules", "", ...answers.map((answer) => `- ${answer}`), ""].join("\n");
    this.writeVersioned(content, "seed-from-onboarding");
  }

  proposeDelta(rule: string, scope: "once" | "context" | "global"): { applied: boolean; rule?: ProfileRule } {
    if (scope === "once") return { applied: false };
    const current = existsSync(this.profilePath) ? readFileSync(this.profilePath, "utf8") : "# Pilot Profile\n\n## Rules\n\n";
    const content = `${current.trim()}\n- ${scope === "context" ? `[context] ${rule}` : rule}\n`;
    this.writeVersioned(content, `delta-${scope}`);
    return {
      applied: true,
      rule: { id: `profile_${nanoid(8)}`, scope: scope === "context" ? "context" : "global", text: rule, weight: 0.3, provisional: true }
    };
  }

  private writeVersioned(content: string, reason: string): void {
    mkdirSync(dirname(this.profilePath), { recursive: true });
    mkdirSync(this.historyDir, { recursive: true });
    writeFileSync(this.profilePath, content);
    writeFileSync(join(this.historyDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${reason}.md`), content);
  }
}

function words(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((word) => word.length > 3);
}
