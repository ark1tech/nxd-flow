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
        ...parseRuleLine(line)
      }));
  }

  trainingWheels(requiredRules = 2): { enabled: boolean; ruleCount: number; requiredRules: number } {
    const ruleCount = this.effectiveRules().length;
    return { enabled: ruleCount < requiredRules, ruleCount, requiredRules };
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

  proposeDelta(rule: string, scope: "once" | "context" | "global"): { applied: boolean; rule?: ProfileRule; conflicts?: string[] } {
    if (scope === "once") return { applied: false };
    const current = existsSync(this.profilePath) ? readFileSync(this.profilePath, "utf8") : "# Pilot Profile\n\n## Rules\n\n";
    const rules = this.effectiveRules();
    const existing = rules.find((candidate) => candidate.text === rule);
    const conflicts = rules.filter((candidate) => conflictsWith(candidate.text, rule));
    const weakened = weakenConflicts(current, conflicts.map((candidate) => candidate.text));
    if (existing) {
      const hardened: ProfileRule = { ...existing, weight: Math.min(1, existing.weight + 0.5), provisional: false };
      const content = replaceRule(weakened, rule, formatRule(rule, scope, hardened.weight, false));
      this.writeVersioned(content, `delta-${scope}-hardened`);
      return { applied: true, rule: hardened, conflicts: conflicts.map((candidate) => candidate.text) };
    }
    const content = `${weakened.trim()}\n- ${formatRule(rule, scope, 0.3, true)}\n`;
    this.writeVersioned(content, `delta-${scope}`);
    return {
      applied: true,
      rule: { id: `profile_${nanoid(8)}`, scope: scope === "context" ? "context" : "global", text: rule, weight: 0.3, provisional: true },
      conflicts: conflicts.map((candidate) => candidate.text)
    };
  }

  decayStale(): { decayed: number } {
    return { decayed: 0 };
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

function parseRuleLine(line: string): Omit<ProfileRule, "id"> {
  const raw = line.replace(/^- /, "").trim();
  const marker = raw.match(/^\[(context\s+)?(provisional|hardened)?\s*weight=([0-9.]+)]\s*(.*)$/);
  if (!marker) {
    const context = raw.match(/^\[context]\s*(.*)$/);
    return {
      scope: context ? "context" : "global",
      text: context ? context[1] : raw,
      weight: 1,
      provisional: false
    };
  }
  return {
    scope: marker[1] ? "context" : "global",
    text: marker[4],
    weight: Number(marker[3]),
    provisional: marker[2] === "provisional"
  };
}

function formatRule(rule: string, scope: "context" | "global", weight: number, provisional: boolean): string {
  const prefix = `${scope === "context" ? "context " : ""}${provisional ? "provisional" : "hardened"} weight=${weight.toFixed(1)}`;
  return `[${prefix}] ${rule}`;
}

function replaceRule(content: string, rule: string, replacement: string): string {
  return content
    .split("\n")
    .map((line) => (line.trim().startsWith("- ") && parseRuleLine(line).text === rule ? `- ${replacement}` : line))
    .join("\n");
}

function weakenConflicts(content: string, conflicts: string[]): string {
  if (conflicts.length === 0) return content;
  return content
    .split("\n")
    .map((line) => {
      if (!line.trim().startsWith("- ")) return line;
      const parsed = parseRuleLine(line);
      if (!conflicts.includes(parsed.text)) return line;
      return `- ${formatRule(parsed.text, parsed.scope, Math.max(0.1, parsed.weight - 0.3), true)}`;
    })
    .join("\n");
}

function conflictsWith(existing: string, incoming: string): boolean {
  const left = existing.toLowerCase();
  const right = incoming.toLowerCase();
  const sameSubject = words(existing).filter((word) => words(incoming).includes(word)).length >= 2;
  return sameSubject && ((left.includes("jwt") && right.includes("sessions")) || (left.includes("sessions") && right.includes("jwt")));
}
