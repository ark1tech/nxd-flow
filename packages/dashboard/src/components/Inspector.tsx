import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { Branch, DashboardSnapshot, DecisionNode, DecisionOption } from "@autopilot/shared";
import { waitingDecision, decisionLabel } from "../hooks/useAutopilotState";
import { DecisionOptionsPanel, RecommendedLabel } from "./DecisionOptionsPanel";
import { EmptyState } from "./EmptyState";

interface InspectorProps {
  embedded?: boolean;
  state: DashboardSnapshot;
  selectedDecision?: DecisionNode;
  compareBranch?: Branch;
  pivoting: boolean;
  onPivot: (id: string, choice: string) => Promise<void>;
  onReview: (id: string) => Promise<void>;
  onSaveLesson: (id: string, body: string) => Promise<void>;
  onClose: () => void;
}

export function Inspector({
  embedded = false,
  state,
  selectedDecision,
  compareBranch,
  pivoting,
  onPivot,
  onReview,
  onSaveLesson,
  onClose
}: InspectorProps): ReactElement {
  const waiting = waitingDecision(state);
  const active = selectedDecision;
  const isWaitingSelected = Boolean(waiting && active?.id === waiting.id);
  const [pivotChoice, setPivotChoice] = useState<string>();
  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonBody, setLessonBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    setPivotChoice(active.options.find((option) => option.id !== active.choice)?.id);
  }, [active?.id]);

  if (!active && !compareBranch) {
    return wrap(
      embedded,
      <>
        {!embedded ? <Header title="Graph" /> : null}
        <EmptyState title="Select a decision" description="Click any node in the graph to inspect it. Checkpoints appear in the agent thread." />
      </>
    );
  }

  if (isWaitingSelected && waiting) {
    return wrap(
      embedded,
      <>
        {!embedded ? <Header title="Checkpoint" onClose={onClose} /> : null}
        <div className="p-4">
          <p className="text-[12px] leading-relaxed text-muted">
            This decision needs your input. Use the <span className="font-medium text-ink">Input needed</span> card in the agent thread to approve or override.
          </p>
          <div className="mt-3 rounded-xl bg-canvas px-3 py-2">
            <p className="text-[11px] text-muted">{waiting.tier} risk · {waiting.ruleFired}</p>
            <p className="mt-1 text-[13px] font-medium text-ink">{waiting.question}</p>
          </div>
        </div>
      </>
    );
  }

  return wrap(
    embedded,
    <>
      {!embedded ? <Header title="Decision" onClose={onClose} /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {compareBranch ? (
          <p className="mb-3 text-[11px] text-muted">
            Branch · {compareBranch.newChoice} · {compareBranch.invalidated.length} re-run
          </p>
        ) : null}

        {active ? (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{active.tier} risk</p>
              <h2 className="mt-1 text-[14px] font-semibold leading-snug text-ink">{active.question}</h2>
              <div className="mt-3">
                <DecisionOptionsPanel decision={active} />
              </div>
              <div className="mt-3">
                <RecommendedLabel decision={active} />
              </div>
            </div>

            {(state.missions[0]?.status === "completed" || active.status === "implemented") && (
              <section className="rounded-xl border border-border p-3">
                <p className="text-[12px] font-medium text-ink">Try another path</p>
                <p className="mt-0.5 text-[11px] text-muted">Branch reruns only downstream steps.</p>
                <div className="mt-2">
                  <OptionPills options={active.options} value={pivotChoice} onChange={setPivotChoice} />
                </div>
                <button
                  type="button"
                  className="mt-2 w-full rounded-lg bg-ink py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                  disabled={pivoting || !pivotChoice}
                  onClick={() => void run(async () => onPivot(active.id, pivotChoice!))}
                >
                  {pivoting ? "Branching…" : "Create branch"}
                </button>
              </section>
            )}

            <section>
              <button
                type="button"
                className="text-[11px] font-medium text-accent"
                onClick={() => setLessonOpen((value) => !value)}
              >
                {lessonOpen ? "Hide lesson" : "Add lesson note"}
              </button>
              {lessonOpen ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="h-24 w-full resize-none rounded-xl border border-border bg-canvas px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder={`Why ${decisionLabel(active)}?`}
                    value={lessonBody}
                    onChange={(event) => setLessonBody(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-border py-1.5 text-[11px]"
                      onClick={() => void run(async () => onReview(active.id))}
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-accent py-1.5 text-[11px] font-semibold text-white"
                      onClick={() => void run(async () => onSaveLesson(active.id, lessonBody))}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }
}

function wrap(embedded: boolean, children: ReactElement): ReactElement {
  if (embedded) {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  }
  return <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-border bg-panel">{children}</aside>;
}

function Header({ title, onClose }: { title: string; onClose?: () => void }): ReactElement {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
      <p className="text-[12px] font-semibold text-ink">{title}</p>
      {onClose ? (
        <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={onClose}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

function OptionPills({
  options,
  value,
  onChange
}: {
  options: DecisionOption[];
  value?: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={[
            "rounded-md px-2 py-1 text-[11px] font-medium",
            value === option.id ? "bg-accent text-white" : "bg-canvas text-ink ring-1 ring-border"
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
