import type { BlastRadiusTier, DecisionNode } from "@autopilot/shared";

const weights: Record<BlastRadiusTier, number> = {
  low: 1,
  medium: 3,
  high: 8,
  critical: 13
};

export interface DebtScore {
  score: number;
  ceilingExceeded: boolean;
  unreviewed: Array<{ id: string; weight: number }>;
}

export function calculateDebt(nodes: DecisionNode[], ceiling = 21): DebtScore {
  const unreviewed = nodes.filter((node) => !node.reviewed).map((node) => ({ id: node.id, weight: weights[node.tier] }));
  const score = unreviewed.reduce((sum, item) => sum + item.weight, 0);
  return { score, ceilingExceeded: score > ceiling, unreviewed };
}
