import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { AgentActivity, DashboardSnapshot, DecisionNode } from "@autopilot/shared";
import { feedItems, threadOffline, waitingDecision, type FeedItem, type StepGroupFeed } from "../hooks/useAutopilotState";
import { EmptyState } from "./EmptyState";

interface ChatRailProps {
  state: DashboardSnapshot;
  running: boolean;
  embedded?: boolean;
  onSelectDecision: (id: string) => void;
  onAnswer: (id: string, mode: "approve" | "override", choice?: string, scope?: "once" | "context" | "global") => Promise<void>;
  onClarify: (answer: string) => Promise<void>;
  onOpenHarness?: () => void;
}

export function ChatRail({
  state,
  running,
  embedded = false,
  onSelectDecision,
  onAnswer,
  onClarify,
  onOpenHarness
}: ChatRailProps): ReactElement {
  const threadRef = useRef<HTMLDivElement>(null);
  const waiting = waitingDecision(state);
  const items = feedItems(state, waiting);
  const offline = threadOffline(state);
  const hasSession = Boolean(state.missions.length);
  const clarifying = Boolean(state.clarification && state.missions[0]?.status === "waiting" && !waiting);
  const hasActiveStep = items.some((item) => item.kind === "step-group" && item.stepGroup?.active);
  const latestActivity = state.activities.at(-1);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length, running, waiting?.id, state.clarification?.currentIndex, state.activities.length, latestActivity?.message]);

  const content = (
    <div ref={threadRef} className="chat-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
      {!hasSession ? (
        <EmptyState title="Start a mission" description="Describe what to build below, then press Run or Enter." />
      ) : (
        <div className="space-y-2.5">
          {offline ? (
            <div className="flex justify-center py-1">
              <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[10px] font-medium text-muted ring-1 ring-border">
                Offline mock
              </span>
            </div>
          ) : null}
          {items.map((item) => (
            <FeedRow
              key={item.id}
              item={item}
              running={running}
              onSelectDecision={onSelectDecision}
              onAnswer={onAnswer}
              onClarify={onClarify}
            />
          ))}
          {running && !waiting && !clarifying && !hasActiveStep ? (
            <WorkingIndicator latestActivity={latestActivity} />
          ) : null}
          {onOpenHarness && state.harnessRecords.length > 0 ? (
            <button type="button" onClick={onOpenHarness} className="w-full rounded-lg border border-border py-1.5 text-[11px] text-muted hover:text-ink">
              View harness ({state.harnessRecords.length} agent calls)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div className="chat-panel flex h-full min-h-0 flex-col">{content}</div>;
  }

  return (
    <aside className="chat-panel flex h-full min-h-0 w-[340px] shrink-0 flex-col border-r border-border bg-panel">
      {content}
    </aside>
  );
}

function FeedRow({
  item,
  running,
  onSelectDecision,
  onAnswer,
  onClarify
}: {
  item: FeedItem;
  running: boolean;
  onSelectDecision: (id: string) => void;
  onAnswer: ChatRailProps["onAnswer"];
  onClarify: ChatRailProps["onClarify"];
}): ReactElement {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end py-1">
        <div className="max-w-[95%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-[13px] leading-snug text-white">{item.text}</div>
      </div>
    );
  }

  if (item.kind === "step-group" && item.stepGroup) {
    return <StepGroupRow group={item.stepGroup} onSelectDecision={onSelectDecision} />;
  }

  if (item.kind === "status") {
    return <p className="py-2 text-center text-[11px] text-muted">{item.text}</p>;
  }

  if (item.kind === "clarification" && item.active && item.clarificationQuestion) {
    return (
      <button
        type="button"
        className="w-full rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-left transition hover:bg-warning/10"
      >
        <p className="text-[11px] font-semibold text-warning">Scope check</p>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink">{item.clarificationQuestion.title}</p>
        <p className="mt-1.5 text-[11px] text-muted">Pick an option in the decision graph →</p>
      </button>
    );
  }

  if (item.kind === "resolved" && item.text) {
    return (
      <div className="rounded-xl border border-border/60 bg-canvas/60 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">You answered</p>
        <p className="mt-0.5 text-[12px] text-ink">{item.text}</p>
      </div>
    );
  }

  if (item.kind === "escalation" && item.decision) {
    return (
      <EscalationCard
        decision={item.decision}
        active={Boolean(item.active)}
        busy={running}
        onSelect={() => onSelectDecision(item.decision!.id)}
        onAnswer={onAnswer}
      />
    );
  }

  return <span />;
}

function StepGroupRow({
  group,
  onSelectDecision
}: {
  group: StepGroupFeed;
  onSelectDecision: (id: string) => void;
}): ReactElement {
  return (
    <div
      className={[
        "rounded-xl border px-3 py-2.5",
        group.active ? "border-accent/25 bg-panel shadow-card" : "border-border/70 bg-panel/80"
      ].join(" ")}
    >
      <div className={`min-w-0 border-l-2 pl-2.5 ${group.active ? "border-accent" : "border-border-strong"}`}>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <p className="min-w-0 text-[11px] font-semibold text-ink">{group.stepTitle}</p>
          {group.active ? <span className="shrink-0 text-[10px] font-medium text-accent">In progress</span> : null}
        </div>

        {group.actions.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {group.actions.map((action, index) => {
              const isLatest = index === group.actions.length - 1;
              const highlighted = group.active && isLatest;
              return (
                <li
                  key={`${group.id}-action-${index}`}
                  className={[
                    "flex min-w-0 items-start gap-1.5 text-[12px] leading-snug",
                    highlighted ? "font-medium text-ink" : "text-muted"
                  ].join(" ")}
                >
                  {highlighted ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" /> : null}
                  <span className="min-w-0 flex-1 break-words">{action}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {group.ramble ? <RambleBlock text={group.ramble} live={Boolean(group.active)} /> : null}

        {group.outcome ? (
          <button
            type="button"
            onClick={() => onSelectDecision(group.outcome!.decisionId)}
            className="mt-2 w-full rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1.5 text-left transition hover:bg-accent/10"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-accent">Chose</p>
            <p className="mt-0.5 text-[12px] font-medium text-ink">{group.outcome.text}</p>
          </button>
        ) : null}
      </div>
    </div>
  );
}

const RAMBLE_LINE_HEIGHT_REM = 1.625;
const RAMBLE_VISIBLE_LINES = 5;

function RambleBlock({ text, live }: { text: string; live: boolean }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const linePx = RAMBLE_LINE_HEIGHT_REM * 12;
    const maxVisible = linePx * RAMBLE_VISIBLE_LINES;
    setOverflows(node.scrollHeight > maxVisible + 4);
  }, [text]);

  const collapsedStyle = !expanded && overflows
    ? { maxHeight: `${RAMBLE_LINE_HEIGHT_REM * RAMBLE_VISIBLE_LINES}rem` }
    : undefined;

  return (
    <div className="mt-1.5 min-w-0">
      {!expanded && overflows ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mb-1 text-[10px] font-medium text-muted/80 transition hover:text-muted"
        >
          Show earlier
        </button>
      ) : null}
      <div
        className={[
          "min-w-0 overflow-hidden text-[12px] leading-relaxed text-muted",
          !expanded && overflows ? "flex flex-col justify-end" : ""
        ].join(" ")}
        style={collapsedStyle}
      >
        <div
          ref={measureRef}
          className={[
            "min-w-0 whitespace-pre-wrap break-words",
            !expanded && overflows ? "opacity-75" : "",
            live && !expanded ? "opacity-80" : ""
          ].join(" ")}
        >
          {text}
        </div>
      </div>
      {expanded && overflows ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 text-[10px] font-medium text-muted/80 transition hover:text-muted"
        >
          Collapse
        </button>
      ) : null}
    </div>
  );
}

function EscalationCard({
  decision,
  active,
  onSelect
}: {
  decision: DecisionNode;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onAnswer: ChatRailProps["onAnswer"];
}): ReactElement {
  if (!active) {
    return (
      <button type="button" onClick={onSelect} className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-left">
        <p className="text-[10px] font-medium text-muted">Checkpoint</p>
        <p className="mt-0.5 text-[12px] text-ink">{decision.question}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5 text-left transition hover:bg-accent/10"
    >
      <p className="text-[11px] font-semibold text-accent">Input needed</p>
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink">{decision.question}</p>
      <p className="mt-1.5 text-[11px] text-muted">Click the highlighted node in the graph →</p>
    </button>
  );
}

function WorkingIndicator({ latestActivity }: { latestActivity?: AgentActivity }): ReactElement {
  const label =
    latestActivity?.kind === "thinking"
      ? "Thinking…"
      : latestActivity?.message?.replace(/…$/, "") ?? "Starting up";

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5 border-l-2 border-accent/40 pl-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <span className="min-w-0 truncate text-[12px] font-medium text-ink">{label}</span>
      </div>
      {latestActivity?.kind === "thinking" && latestActivity.message ? (
        <RambleBlock text={latestActivity.message} live />
      ) : latestActivity?.message && latestActivity.kind !== "thinking" ? (
        <p className="mt-1.5 pl-4 text-[12px] leading-snug text-muted">{latestActivity.message}</p>
      ) : null}
    </div>
  );
}
