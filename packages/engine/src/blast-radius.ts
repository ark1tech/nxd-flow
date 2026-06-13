import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { BlastRadiusTier, Surface } from "@autopilot/shared";

const tierRank: Record<BlastRadiusTier, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export interface BlastPolicy {
  tiers: Record<string, BlastRadiusTier>;
  overrides?: Array<{ match: string; tier: BlastRadiusTier; rule?: string }>;
}

export interface Classification {
  tier: BlastRadiusTier;
  ruleFired: string;
  consequential: boolean;
}

export class BlastRadiusClassifier {
  constructor(private readonly policy: BlastPolicy) {}

  static fromFile(path: string): BlastRadiusClassifier {
    const raw = readFileSync(path, "utf8");
    return new BlastRadiusClassifier(parse(raw) as BlastPolicy);
  }

  classify(surfaces: Surface[]): Classification {
    if (surfaces.length === 0) {
      return { tier: "low", ruleFired: "default:low", consequential: false };
    }
    let tier: BlastRadiusTier = "low";
    let ruleFired = "default:low";
    for (const surface of surfaces) {
      const override = this.policy.overrides?.find((item) => matches(item.match, surface.locator ?? surface.id));
      const candidate = override?.tier ?? this.policy.tiers[surface.kind] ?? "low";
      const rule = override?.rule ?? `surface:${surface.kind}`;
      if (tierRank[candidate] >= tierRank[tier]) {
        tier = candidate;
        ruleFired = rule;
      }
    }
    return { tier, ruleFired, consequential: this.isConsequential(surfaces) };
  }

  isConsequential(surfaces: Surface[]): boolean {
    return surfaces.length > 0 || surfaces.some((surface) => surface.kind === "foundational-dependency");
  }
}

function matches(pattern: string, value: string): boolean {
  if (pattern === value) return true;
  if (pattern.endsWith("/**")) return value.startsWith(pattern.slice(0, -3));
  if (pattern.includes("*")) {
    const regex = new RegExp(`^${pattern.split("*").map(escapeRegex).join(".*")}$`);
    return regex.test(value);
  }
  return false;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
