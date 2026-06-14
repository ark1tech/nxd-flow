import type { ClarificationOption, ClarificationQuestion, ClarificationState, DecisionNode, DecisionOption } from "@autopilot/shared";

export const OPTION_NODE_PREFIX = "gopt:";
export const SCOPE_NODE_ID = "gscope:root";
export const SCOPE_OPTION_PREFIX = "gscopeopt:";

export function optionGraphId(decisionId: string, optionId: string): string {
  return `${OPTION_NODE_PREFIX}${decisionId}:${optionId}`;
}

export function scopeOptionGraphId(optionId: string): string {
  return `${SCOPE_OPTION_PREFIX}${optionId}`;
}

export function parseOptionGraphId(id: string): { decisionId: string; optionId: string } | null {
  if (!id.startsWith(OPTION_NODE_PREFIX)) return null;
  const rest = id.slice(OPTION_NODE_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep === -1) return null;
  return { decisionId: rest.slice(0, sep), optionId: rest.slice(sep + 1) };
}

export function parseScopeOptionGraphId(id: string): string | null {
  if (!id.startsWith(SCOPE_OPTION_PREFIX)) return null;
  return id.slice(SCOPE_OPTION_PREFIX.length);
}

export type GraphSelection =
  | { kind: "decision"; decision: DecisionNode }
  | { kind: "option"; decision: DecisionNode; option: DecisionOption }
  | { kind: "scope"; question: ClarificationQuestion }
  | { kind: "scope-option"; question: ClarificationQuestion; option: ClarificationOption };

export function activeClarificationQuestion(clarification?: ClarificationState): ClarificationQuestion | undefined {
  if (!clarification) return undefined;
  return clarification.questions[clarification.currentIndex];
}

export function resolveGraphSelection(
  decisions: DecisionNode[],
  clarification: ClarificationState | undefined,
  nodeId?: string
): GraphSelection | null {
  if (!nodeId) return null;

  const scopeOptionId = parseScopeOptionGraphId(nodeId);
  if (scopeOptionId) {
    const question = activeClarificationQuestion(clarification);
    const option = question?.options.find((item) => item.id === scopeOptionId);
    if (!question || !option) return null;
    return { kind: "scope-option", question, option };
  }

  if (nodeId === SCOPE_NODE_ID) {
    const question = activeClarificationQuestion(clarification);
    if (!question) return null;
    return { kind: "scope", question };
  }

  const optionRef = parseOptionGraphId(nodeId);
  if (optionRef) {
    const decision = decisions.find((item) => item.id === optionRef.decisionId);
    const option = decision?.options.find((item) => item.id === optionRef.optionId);
    if (!decision || !option) return null;
    return { kind: "option", decision, option };
  }

  const decision = decisions.find((item) => item.id === nodeId);
  if (!decision) return null;
  return { kind: "decision", decision };
}

export function pickedOptionIdFromSelection(selection: GraphSelection | null, fallbackChoice?: string): string | undefined {
  if (selection?.kind === "option") return selection.option.id;
  if (selection?.kind === "scope-option") return selection.option.id;
  return fallbackChoice;
}

export function pickedScopeOptionIdFromSelection(
  selection: GraphSelection | null,
  fallbackRecommendation?: string
): string | undefined {
  if (selection?.kind === "scope-option") return selection.option.id;
  return fallbackRecommendation;
}
