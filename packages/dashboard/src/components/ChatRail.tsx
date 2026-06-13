import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot, DecisionNode } from "@autopilot/shared";
import { decisionLabel, feedItems, threadOffline, waitingDecision, type FeedItem, type StepGroupFeed } from "../hooks/useAutopilotState";
import { DecisionOptionsPanel } from "./DecisionOptionsPanel";
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

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length, running, waiting?.id, state.clarification?.currentIndex]);

  const content = (
    <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
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
          {running && !waiting && !clarifying ? <WorkingIndicator /> : null}
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
    return <div className="flex h-full min-h-0 flex-col">{content}</div>;
  }

  return <aside className="flex h-full min-h-0 w-[340px] shrink-0 flex-col border-r border-border bg-panel">{content}</aside>;
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

  if (item.kind === "clarification" && item.active) {
    return <ClarificationCard question={item.text ?? ""} busy={running} onSubmit={onClarify} />;
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
    <div className="rounded-xl border border-border/70 bg-panel/80 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-full w-0.5 shrink-0 self-stretch rounded-full ${group.active ? "bg-accent" : "bg-border-strong"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-ink">{group.stepTitle}</p>
            {group.active ? <span className="text-[10px] font-medium text-accent">In progress</span> : null}
          </div>
          {group.thoughts.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {group.thoughts.map((thought, index) => (
                <li key={`${group.id}-thought-${index}`} className="text-[12px] leading-relaxed text-muted">
                  {thought}
                </li>
              ))}
            </ul>
          ) : null}
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
    </div>
  );
}

function ClarificationCard({
  question,
  busy,
  onSubmit
}: {
  question: string;
  busy: boolean;
  onSubmit: (answer: string) => Promise<void>;
}): ReactElement {
  const [answer, setAnswer] = useState("");
  return (
    <div className="rounded-xl border border-warning/30 bg-panel p-3 shadow-card">
      <p className="text-[11px] font-semibold text-warning">Scope check</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ink">{question}</p>
      <textarea
        className="mt-2 h-16 w-full resize-none rounded-xl border border-border bg-canvas px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/20"
        placeholder="Your answer…"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <button
        type="button"
        disabled={busy || !answer.trim()}
        className="mt-2 w-full rounded-xl bg-accent py-2 text-[12px] font-semibold text-white disabled:opacity-50"
        onClick={() => void onSubmit(answer.trim())}
      >
        Continue
      </button>
    </div>
  );
}

function EscalationCard({
  decision,
  active,
  busy,
  onSelect,
  onAnswer
}: {
  decision: DecisionNode;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onAnswer: ChatRailProps["onAnswer"];
}): ReactElement {
  const [showOverride, setShowOverride] = useState(false);
  const [overrideChoice, setOverrideChoice] = useState(decision.options.find((o) => o.id !== decision.choice)?.id);
  const proposed = decisionLabel(decision);

  if (!active) {
    return (
      <button type="button" onClick={onSelect} className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-left">
        <p className="text-[10px] font-medium text-muted">Checkpoint</p>
        <p className="mt-0.5 text-[12px] text-ink">{decision.question}</p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/25 bg-panel p-3 shadow-card" onClick={onSelect}>
      <p className="text-[11px] font-semibold text-accent">Input needed</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ink">{decision.question}</p>
      <div className="mt-2 max-h-48 overflow-y-auto">
        <DecisionOptionsPanel decision={decision} />
      </div>
      <div className="mt-2 rounded-xl bg-canvas px-2.5 py-2">
        <p className="text-[10px] text-muted">Pilot recommends</p>
        <p className="text-[13px] font-medium text-ink">{proposed}</p>
      </div>
      {!showOverride ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={busy}
            className="w-full rounded-xl bg-accent py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              void onAnswer(decision.id, "approve");
            }}
          >
            Approve recommendation
          </button>
          <button
            type="button"
            className="w-full text-[11px] font-medium text-muted hover:text-ink"
            onClick={(event) => {
              event.stopPropagation();
              setShowOverride(true);
            }}
          >
            Choose another option
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
          <div className="flex flex-wrap gap-1.5">
            {decision.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setOverrideChoice(option.id)}
                className={[
                  "rounded-md px-2.5 py-1 text-[11px] font-medium",
                  overrideChoice === option.id ? "bg-accent text-white" : "bg-canvas text-ink ring-1 ring-border"
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !overrideChoice}
            className="w-full rounded-xl border border-border py-2 text-[12px] font-medium text-ink disabled:opacity-50"
            onClick={() => void onAnswer(decision.id, "override", overrideChoice, "context")}
          >
            Submit choice
          </button>
        </div>
      )}
    </div>
  );
}

function WorkingIndicator(): ReactElement {
  return (
    <div className="border-l-2 border-accent/40 pl-2.5 py-1">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="h-1 w-1 animate-pulse rounded-full bg-accent" />
        <span>Autopilot is working…</span>
      </div>
    </div>
  );
}
