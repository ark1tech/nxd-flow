import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { nanoid } from "nanoid";
import type { KnowledgeFact } from "@autopilot/shared";

export class KnowledgeStore {
  constructor(
    private readonly path: string,
    private readonly repoRoot: string
  ) {}

  list(): KnowledgeFact[] {
    if (!existsSync(this.path)) return [];
    const content = readFileSync(this.path, "utf8");
    const match = content.match(/```json\n([\s\S]*?)\n```/);
    if (!match) return [];
    return JSON.parse(match[1]) as KnowledgeFact[];
  }

  propose(input: Omit<KnowledgeFact, "id" | "status" | "confidence" | "createdAt" | "updatedAt">): KnowledgeFact {
    const facts = this.list();
    const now = new Date().toISOString();
    const same = facts.find((fact) => fact.subject === input.subject && fact.claim === input.claim);
    if (same) {
      same.lastConfirmedAt = now;
      same.updatedAt = now;
      this.write(facts);
      return same;
    }
    const contradictory = facts.find((fact) => fact.subject === input.subject && fact.claim !== input.claim);
    const status = input.locator ? "active" : "hint-only";
    const fact: KnowledgeFact = {
      ...input,
      id: `kn_${nanoid(10)}`,
      status: contradictory ? "contested" : status,
      confidence: input.locator ? 0.7 : 0.2,
      lastConfirmedAt: input.locator ? now : undefined,
      createdAt: now,
      updatedAt: now
    };
    facts.push(fact);
    this.write(facts);
    return fact;
  }

  revalidate(fact: KnowledgeFact): "fresh" | "stale" | "hint-only" | "contested" {
    if (fact.status === "contested") return "contested";
    if (!fact.locator) return "hint-only";
    try {
      if (fact.locator.kind === "file-symbol") {
        const content = readFileSync(`${this.repoRoot}/${fact.locator.locator}`, "utf8");
        return fact.locator.expected ? (content.includes(fact.locator.expected) ? "fresh" : "stale") : "fresh";
      }
      if (fact.locator.kind === "pattern") {
        const content = readFileSync(`${this.repoRoot}/${fact.locator.locator}`, "utf8");
        return fact.locator.expected && new RegExp(fact.locator.expected, "m").test(content) ? "fresh" : "stale";
      }
      const [command, ...args] = fact.locator.locator.split(" ");
      const output = execFileSync(command, args, { cwd: this.repoRoot, encoding: "utf8" });
      return fact.locator.expected ? (output.includes(fact.locator.expected) ? "fresh" : "stale") : "fresh";
    } catch {
      return "stale";
    }
  }

  coverageFor(text: string): { evidence: string[]; stale: string[] } {
    const lower = text.toLowerCase();
    const evidence: string[] = [];
    const stale: string[] = [];
    for (const fact of this.list()) {
      if (!words(fact.claim).some((word) => lower.includes(word))) continue;
      const state = this.revalidate(fact);
      if (state === "fresh") evidence.push(`${fact.subject}: ${fact.claim}`);
      if (state === "stale" || state === "contested") stale.push(`${fact.subject}: ${fact.claim}`);
    }
    return { evidence, stale };
  }

  materializeMemory(path: string, contents: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }

  private write(facts: KnowledgeFact[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, ["# Project Knowledge", "", "```json", JSON.stringify(facts, null, 2), "```", ""].join("\n"));
  }
}

function words(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((word) => word.length > 3);
}
