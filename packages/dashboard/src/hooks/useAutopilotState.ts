import { useCallback, useEffect, useRef, useState } from "react";
import type { ClarificationQuestion, DashboardMessage, DashboardSnapshot, DecisionNode, MissionSummary } from "@autopilot/shared";
import { clarificationAnswerLabel } from "@autopilot/shared";

export const emptyState: DashboardSnapshot = {
  missions: [],
  decisions: [],
  edges: [],
  events: [],
  branches: [],
  pendingNodes: [],
  activities: [],
  harnessRecords: []
};

export function useAutopilotState() {
  const [state, setState] = useState<DashboardSnapshot>(emptyState);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const [sessionMissionId, setSessionMissionId] = useState<string>();
  const sessionRef = useRef<string | undefined>(undefined);

  const loadMissions = useCallback(async () => {
    const res = await fetch("/api/missions");
    const payload = (await res.json()) as { missions: MissionSummary[] };
    setMissions(payload.missions ?? []);
  }, []);

  const clearMissions = useCallback(async () => {
    await fetch("/api/missions/clear", { method: "POST" });
    sessionRef.current = undefined;
    setSessionMissionId(undefined);
    setState(emptyState);
    await loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    sessionRef.current = sessionMissionId;
  }, [sessionMissionId]);

  useEffect(() => {
    void loadMissions();
    setState(emptyState);

    const ws = new WebSocket(`ws://${window.location.hostname}:4317`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as DashboardMessage;
      const sessionId = sessionRef.current;

      if (message.type === "state") {
        void loadMissions();
        if (!sessionId) {
          setState(emptyState);
          return;
        }
        void applySessionState(message.payload, sessionId).then(setState);
        return;
      }
      if (message.type === "event") {
        if (message.payload.missionId && sessionId && message.payload.missionId !== sessionId) return;
        setState((current) => ({ ...current, events: [...current.events, message.payload] }));
        return;
      }
      if (message.type === "activity") {
        if (sessionId && message.payload.missionId && message.payload.missionId !== sessionId) return;
        setState((current) => {
          const incoming = message.payload;
          if (incoming.kind === "thinking") {
            const activities = [...current.activities];
            const last = activities.at(-1);
            if (
              last?.kind === "thinking" &&
              last.missionId === incoming.missionId &&
              last.stepId === incoming.stepId
            ) {
              activities[activities.length - 1] = incoming;
              return { ...current, activities };
            }
          }
          return { ...current, activities: [...current.activities.slice(-49), incoming] };
        });
        return;
      }
      if (message.type === "pending") {
        if (sessionId && message.payload.missionId !== sessionId) return;
        setState((current) => ({
          ...current,
          pendingNodes: [...current.pendingNodes.filter((node) => node.missionId !== message.payload.missionId), message.payload]
        }));
        return;
      }
      if (message.type === "pending.clear") {
        setState((current) => ({
          ...current,
          pendingNodes: current.pendingNodes.filter((node) => node.id !== message.payload.id)
        }));
      }
    };
    return () => ws.close();
  }, [loadMissions]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state");
    const payload = (await res.json()) as DashboardSnapshot;
    await loadMissions();
    if (!sessionRef.current) {
      setState(emptyState);
      return;
    }
    setState(await applySessionState(payload, sessionRef.current));
  }, [loadMissions]);

  const switchSession = useCallback(async (missionId: string) => {
    sessionRef.current = missionId;
    setSessionMissionId(missionId);
    const res = await fetch("/api/state");
    const payload = (await res.json()) as DashboardSnapshot;
    setState(await applySessionState(payload, missionId));
  }, []);

  useEffect(() => {
    if (!sessionMissionId) return;
    const mission = state.missions[0];
    if (mission?.status !== "waiting" || state.clarification) return;
    void enrichSessionState(state, sessionMissionId).then((enriched) => {
      if (enriched.clarification) setState(enriched);
    });
  }, [sessionMissionId, state.missions[0]?.status, state.clarification?.missionId]);

  const sessionState = filterSessionState(state, sessionMissionId);

  return { state: sessionState, missions, connected, refresh, sessionMissionId, switchSession, clearMissions, beginSession: switchSession };
}

function clarificationForSession(state: DashboardSnapshot, sessionMissionId?: string): DashboardSnapshot["clarification"] {
  if (!sessionMissionId) return undefined;
  const items = state.clarifications ?? (state.clarification ? [state.clarification] : []);
  return items.find((item) => item.missionId === sessionMissionId) ?? (state.clarification?.missionId === sessionMissionId ? state.clarification : undefined);
}

async function enrichSessionState(state: DashboardSnapshot, sessionMissionId: string): Promise<DashboardSnapshot> {
  if (clarificationForSession(state, sessionMissionId)) return state;
  const mission = state.missions.find((item) => item.id === sessionMissionId) ?? state.missions[0];
  if (!mission || mission.status !== "waiting") return state;
  try {
    const res = await fetch(`/api/missions/${sessionMissionId}/clarification`);
    if (!res.ok) return state;
    const payload = (await res.json()) as { clarification?: NonNullable<DashboardSnapshot["clarification"]> };
    if (!payload.clarification) return state;
    const clarifications = [...(state.clarifications ?? []), payload.clarification];
    return { ...state, clarifications, clarification: payload.clarification };
  } catch {
    return state;
  }
}

async function applySessionState(payload: DashboardSnapshot, sessionMissionId: string): Promise<DashboardSnapshot> {
  const filtered = filterSessionState(payload, sessionMissionId);
  return enrichSessionState(filtered, sessionMissionId);
}

export function filterSessionState(state: DashboardSnapshot, sessionMissionId?: string): DashboardSnapshot {
  if (!sessionMissionId) return emptyState;
  const decisions = state.decisions.filter((decision) => decision.missionId === sessionMissionId);
  const decisionIds = new Set(decisions.map((decision) => decision.id));
  return {
    ...state,
    missions: state.missions.filter((mission) => mission.id === sessionMissionId),
    decisions,
    edges: state.edges.filter((edge) => decisionIds.has(edge.from) || decisionIds.has(edge.to)),
    activities: state.activities.filter((activity) => activity.missionId === sessionMissionId),
    pendingNodes: state.pendingNodes.filter((node) => node.missionId === sessionMissionId),
    branches: state.branches.filter((branch) => branch.missionId === sessionMissionId),
    events: state.events.filter((event) => event.missionId === sessionMissionId),
    harnessRecords: state.harnessRecords.filter((record) => record.missionId === sessionMissionId),
    clarification: clarificationForSession(state, sessionMissionId),
    messages: (state.messages ?? []).filter((message) => message.missionId === sessionMissionId),
    preview: state.preview?.missionId === sessionMissionId ? state.preview : undefined
  };
}

export function tierWeight(tier: string): number {
  return { low: 1, medium: 3, high: 8, critical: 13 }[tier] ?? 1;
}

export function latestMission(state: DashboardSnapshot) {
  return state.missions.at(-1);
}

export function waitingDecision(state: DashboardSnapshot): DecisionNode | undefined {
  if (state.clarification && state.missions.some((mission) => mission.status === "waiting")) return undefined;
  const waitingMissionIds = new Set(state.missions.filter((mission) => mission.status === "waiting").map((mission) => mission.id));
  return [...state.decisions].reverse().find((decision) => waitingMissionIds.has(decision.missionId) && decision.status === "proposed");
}

export function threadOffline(state: DashboardSnapshot): boolean {
  return state.harnessRecords.some((record) => record.fallbackUsed);
}

export interface StepGroupFeed {
  id: string;
  stepId?: string;
  stepTitle: string;
  actions: string[];
  ramble?: string;
  currentAction?: string;
  outcome?: { text: string; decisionId: string };
  active?: boolean;
}

export interface FeedItem {
  id: string;
  kind: "user" | "step-group" | "status" | "escalation" | "resolved" | "clarification";
  text?: string;
  clarificationQuestion?: ClarificationQuestion;
  stepGroup?: StepGroupFeed;
  decision?: DecisionNode;
  active?: boolean;
}

export function feedItems(state: DashboardSnapshot, waiting?: DecisionNode): FeedItem[] {
  const mission = state.missions[0];
  if (!mission) return [];

  const items: FeedItem[] = [];

  const initialUser = (state.messages ?? []).find((message) => message.role === "user")?.text ?? mission.idea;
  items.push({ id: "user-prompt", kind: "user", text: initialUser });

  for (const message of state.messages ?? []) {
    if (message.role !== "user" || message.text === initialUser) continue;
    items.push({ id: message.id, kind: "user", text: message.text });
  }

  const stepNameById = buildStepNameLookup(state);
  const stepGroups = buildStepGroups(state, stepNameById, waiting);
  for (const group of stepGroups) {
    items.push({ id: group.id, kind: "step-group", stepGroup: group });
  }

  if (state.clarification) {
    for (let index = 0; index < state.clarification.answers.length; index += 1) {
      const question = state.clarification.questions[index];
      const raw = state.clarification.answers[index];
      items.push({
        id: `clar-answer-${index}`,
        kind: "resolved",
        text: question ? clarificationAnswerLabel(question, raw) : raw
      });
    }
    const activeQuestion = state.clarification.questions[state.clarification.currentIndex];
    if (activeQuestion && mission.status === "waiting" && !waiting) {
      items.push({
        id: "clarification-active",
        kind: "clarification",
        clarificationQuestion: activeQuestion,
        active: true
      });
    }
  }

  const escalatedIds = new Set<string>();
  for (const event of state.events) {
    if (event.type !== "gate.escalated") continue;
    const decisionId = (event.payload as { decisionId?: string }).decisionId;
    if (!decisionId || escalatedIds.has(decisionId)) continue;
    escalatedIds.add(decisionId);
    const decision = state.decisions.find((node) => node.id === decisionId);
    if (!decision) continue;
    const isActive = waiting?.id === decision.id;
    if (isActive) {
      items.push({ id: decision.id, kind: "escalation", decision, active: true });
    }
  }

  if (waiting && !escalatedIds.has(waiting.id)) {
    items.push({ id: waiting.id, kind: "escalation", decision: waiting, active: true });
  }

  if (mission.status === "waiting" && !state.clarification && !waiting) {
    items.push({
      id: "system-waiting",
      kind: "status",
      text: "Waiting for your input — pick an option in the decision graph."
    });
  }

  if (mission.status === "completed") {
    items.push({ id: "system-done", kind: "status", text: "Mission complete — open the graph to review or branch." });
  }
  if (mission.status === "failed") {
    items.push({ id: "system-failed", kind: "status", text: "Mission failed." });
  }

  return items;
}

export function decisionLabel(decision: DecisionNode): string {
  return decision.options.find((option) => option.id === decision.choice)?.label ?? decision.choice;
}

function buildStepNameLookup(state: DashboardSnapshot): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const record of state.harnessRecords) {
    if (record.stepId) lookup.set(record.stepId, record.stepName);
  }
  for (const pending of state.pendingNodes) {
    lookup.set(pending.stepId, pending.stepName);
  }
  for (const decision of state.decisions) {
    if (decision.stepId && !lookup.has(decision.stepId)) {
      lookup.set(decision.stepId, decision.stepId);
    }
  }
  return lookup;
}

function buildStepGroups(
  state: DashboardSnapshot,
  stepNameById: Map<string, string>,
  waiting?: DecisionNode
): StepGroupFeed[] {
  const groups: StepGroupFeed[] = [];
  const groupByKey = new Map<string, StepGroupFeed>();
  const actionKeys = new Set<string>();

  const ensureGroup = (key: string, stepId: string | undefined, stepName: string): StepGroupFeed => {
    const existing = groupByKey.get(key);
    if (existing) return existing;
    const group: StepGroupFeed = {
      id: `step-${key}`,
      stepId,
      stepTitle: stepTitle(stepName),
      actions: []
    };
    groupByKey.set(key, group);
    groups.push(group);
    return group;
  };

  const addAction = (key: string, stepId: string | undefined, stepName: string, text: string): void => {
    const dedupeKey = `${key}::${text}`;
    if (actionKeys.has(dedupeKey)) return;
    actionKeys.add(dedupeKey);
    const group = ensureGroup(key, stepId, stepName);
    group.actions.push(text);
    group.currentAction = text;
  };

  for (const activity of state.activities) {
    const stepId = activity.stepId;
    const stepName = stepId ? stepNameById.get(stepId) ?? stepId : inferPreStepName(activity.message);
    if (stepName === "scope" && state.clarification) continue;
    const key = stepId ?? `pre-${stepName}`;

    if (activity.kind === "thinking") {
      const ramble = cleanRamble(activity.message);
      if (ramble) ensureGroup(key, stepId, stepName).ramble = ramble;
      continue;
    }

    const text = humanizeActivity(activity.message);
    if (!text) continue;
    addAction(key, stepId, stepName, text);
  }

  const pending = state.pendingNodes.at(-1);
  const missionRunning = state.missions[0]?.status === "running";
  if (pending && missionRunning) {
    const group = ensureGroup(pending.stepId, pending.stepId, pending.stepName);
    group.active = true;
    if (pending.label) addAction(pending.stepId, pending.stepId, pending.stepName, pending.label);
  }

  for (const group of groups) {
    if (!group.stepId) continue;
    const decision = state.decisions.find((node) => node.stepId === group.stepId);
    if (!decision) continue;
    if (decision.status === "proposed" && waiting?.id === decision.id) continue;
    const decided = decision.status !== "proposed" && decision.status !== "escalated";
    const autoDecided = state.events.some(
      (event) => event.type === "gate.decided" && (event.payload as { decisionId?: string }).decisionId === decision.id
    );
    if (decided || autoDecided) {
      group.outcome = { text: decisionLabel(decision), decisionId: decision.id };
    }
  }

  return groups.filter((group) => group.actions.length > 0 || group.ramble || group.outcome || group.active);
}

function inferPreStepName(text: string): string {
  if (/scope|clarif/i.test(text)) return "scope";
  if (/plan/i.test(text)) return "plan";
  return "setup";
}

function stepTitle(stepName: string): string {
  const labels: Record<string, string> = {
    scope: "Scope check",
    plan: "Planning",
    setup: "Getting started",
    "project-layout": "Project layout",
    "auth-strategy": "Auth strategy",
    "auth-persistence": "Auth persistence",
    "site-stack": "Site stack",
    "site-pages": "Pages & navigation",
    "site-auth": "Google auth",
    "mission-plan": "Architecture",
    "mission-implementation": "Implementation",
    "mission-handoff": "Handoff",
    "follow-up": "Follow-up"
  };
  return labels[stepName] ?? stepName.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanRamble(message: string): string | null {
  const text = message
    .replace(/^\[Offline\]\s*/i, "")
    .replace(/^Harness:\s*\w+\s+\S+\s*$/i, "")
    .trim();
  if (!text || looksLikeJsonFragment(text)) return null;
  return text;
}

function humanizeActivity(message: string): string | null {
  const text = message
    .replace(/^\[Offline\]\s*/i, "")
    .replace(/^Harness:\s*\w+\s+\S+\s*$/i, "")
    .replace(/Mock \w+ running /i, "")
    .replace(/Mock plan ready/i, "Plan ready")
    .replace(/Branch: /i, "")
    .trim();

  if (!text) return null;
  if (looksLikeJsonFragment(text)) return null;
  if (/^Recording decision/i.test(text)) return "Recording decision…";
  if (/^Checking scope/i.test(text)) return null;
  return text;
}

function looksLikeJsonFragment(text: string): boolean {
  const trimmed = text.trim();
  if (/^[\{\}\[\]",:`]/.test(trimmed)) return true;
  if (/^```/.test(trimmed)) return true;
  if (trimmed.length <= 2 && /^[\w",:\[\]{}\\]+$/.test(trimmed)) return true;
  if (/^"(ready|questions|title|context|options|recommendation)"/.test(trimmed)) return true;
  return false;
}
