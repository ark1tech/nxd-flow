import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { Branch, ClarificationOption, DashboardSnapshot, DecisionNode, DecisionOption } from "@autopilot/shared";
import { waitingDecision, decisionLabel } from "../hooks/useAutopilotState";
import { RecommendedLabel } from "./DecisionOptionsPanel";
import {
  ClarificationCheckpointFooter,
  DecisionCheckpointFooter,
  type DecisionAnswerHandler
} from "./DecisionInputPanel";
import { EmptyState } from "./EmptyState";
import type { GraphSelection } from "../lib/graphNodes";

interface InspectorProps {
  embedded?: boolean;
  state: DashboardSnapshot;
  selection: GraphSelection | null;
  compareBranch?: Branch;
  pivoting: boolean;
  busy?: boolean;
  isPicking?: boolean;
  isScopePicking?: boolean;
  pickedOptionId?: string;
  pickedScopeOptionId?: string;
  onAnswer?: DecisionAnswerHandler;
  onClarify?: (answer: string) => Promise<void>;
  onPivot: (id: string, choice: string) => Promise<void>;
  onReview: (id: string) => Promise<void>;
  onSaveLesson: (id: string, body: string) => Promise<void>;
  onClose: () => void;
  onPickOption: (optionId: string) => void;
  onPickScopeOption: (optionId: string) => void;
}

export function Inspector({
  embedded = false,
  state,
  selection,
  compareBranch,
  pivoting,
  busy = false,
  isPicking = false,
  isScopePicking = false,
  pickedOptionId,
  pickedScopeOptionId,
  onAnswer,
  onClarify,
  onPivot,
  onReview,
  onSaveLesson,
  onClose,
  onPickOption,
  onPickScopeOption
}: InspectorProps): ReactElement {
  const waiting = waitingDecision(state);
  const [pivotChoice, setPivotChoice] = useState<string>();
  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonBody, setLessonBody] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [customScopeText, setCustomScopeText] = useState("");

  const decision = selection?.kind === "decision" || selection?.kind === "option" ? selection.decision : undefined;
  const activeOption = selection?.kind === "option" ? selection.option : undefined;
  const scopeQuestion = selection?.kind === "scope" || selection?.kind === "scope-option" ? selection.question : undefined;
  const activeScopeOption = selection?.kind === "scope-option" ? selection.option : undefined;

  useEffect(() => {
    if (!decision) return;
    setPivotChoice(decision.options.find((option) => option.id !== decision.choice)?.id);
  }, [decision?.id]);

  if (isScopePicking && scopeQuestion && onClarify) {
    return wrap(
      embedded,
      <>
        {!embedded ? <Header title="Scope check" onClose={onClose} /> : null}
        <div className="hover-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {activeScopeOption ? (
            <ScopeOptionDetail option={activeScopeOption} recommended={activeScopeOption.id === scopeQuestion.recommendation} />
          ) : (
            <ScopeDetail question={scopeQuestion} />
          )}
        </div>
        <ClarificationCheckpointFooter
          question={scopeQuestion}
          busy={busy || actionBusy}
          selectedId={pickedScopeOptionId}
          customText={customScopeText}
          onCustomText={setCustomScopeText}
          onSelect={(optionId) => onPickScopeOption(optionId)}
          onClarify={onClarify}
        />
      </>
    );
  }

  if (!selection && !compareBranch) {
    const mission = state.missions[0];
    const awaitingInput = mission?.status === "waiting";
    return wrap(
      embedded,
      <>
        {!embedded ? <Header title="Decision" /> : null}
        <EmptyState
          title={awaitingInput ? "Pick in the graph" : "Select a node"}
          description={
            awaitingInput
              ? "Click an option node in the decision graph. Details appear here."
              : "Click a decision or option in the graph. Pros, cons, and rationale appear here."
          }
        />
      </>
    );
  }

  const title = isPicking && decision?.id === waiting?.id ? "Checkpoint" : "Decision";

  return wrap(
    embedded,
    <>
      {!embedded ? <Header title={title} onClose={onClose} /> : null}

      <div className="hover-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {compareBranch ? (
          <p className="mb-3 text-[11px] text-muted">
            Branch · {compareBranch.newChoice} · {compareBranch.invalidated.length} re-run
          </p>
        ) : null}

        {decision && activeOption ? (
          <OptionDetail option={activeOption} recommended={activeOption.id === decision.choice} />
        ) : null}

        {decision && !activeOption ? (
          <DecisionDetail decision={decision} isPicking={isPicking && decision.id === waiting?.id} />
        ) : null}

        {decision && !isPicking && !activeOption ? (
          <div className="mt-4 space-y-4">
            <RecommendedLabel decision={decision} />
            {(state.missions[0]?.status === "completed" || decision.status === "implemented") && (
              <PivotSection
                decision={decision}
                pivotChoice={pivotChoice}
                pivoting={pivoting}
                onPivotChoice={setPivotChoice}
                onPivot={() => void run(async () => onPivot(decision.id, pivotChoice!))}
              />
            )}
            <LessonSection
              decision={decision}
              lessonOpen={lessonOpen}
              lessonBody={lessonBody}
              onToggle={() => setLessonOpen((value) => !value)}
              onLessonBody={setLessonBody}
              onReview={() => void run(async () => onReview(decision.id))}
              onSave={() => void run(async () => onSaveLesson(decision.id, lessonBody))}
            />
          </div>
        ) : null}
      </div>

      {isPicking && waiting && onAnswer && decision?.id === waiting.id ? (
        <DecisionCheckpointFooter
          decision={waiting}
          busy={busy || actionBusy}
          selectedId={pickedOptionId}
          onSelect={onPickOption}
          onAnswer={onAnswer}
        />
      ) : null}
    </>
  );

  async function run(action: () => Promise<void>): Promise<void> {
    setActionBusy(true);
    try {
      await action();
    } finally {
      setActionBusy(false);
    }
  }
}

function ScopeDetail({ question }: { question: { title: string; context: string } }): ReactElement {
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-warning">Scope check</span>
      <h2 className="mt-2 text-[14px] font-semibold leading-snug text-ink">{question.title}</h2>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{question.context}</p>
      <p className="mt-3 text-[11px] text-muted">Select an option node in the graph to compare pros and cons.</p>
    </div>
  );
}

function ScopeOptionDetail({ option, recommended }: { option: ClarificationOption; recommended: boolean }): ReactElement {
  return <OptionDetail option={option} recommended={recommended} />;
}

function DecisionDetail({ decision, isPicking }: { decision: DecisionNode; isPicking: boolean }): ReactElement {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {isPicking ? <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">Input needed</span> : null}
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{decision.tier} risk</span>
        <span className="text-[10px] text-muted">{decision.ruleFired}</span>
      </div>
      <h2 className="mt-2 text-[14px] font-semibold leading-snug text-ink">{decision.question}</h2>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{decision.rationale}</p>
      {isPicking ? (
        <p className="mt-3 text-[11px] text-muted">Select an option node in the graph to compare pros and cons.</p>
      ) : null}
    </div>
  );
}

function OptionDetail({
  option,
  recommended
}: {
  option: DecisionOption | ClarificationOption;
  recommended: boolean;
}): ReactElement {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Option</span>
        {recommended ? <span className="text-[10px] font-semibold text-accent">Recommended</span> : null}
      </div>
      <h2 className="mt-1 text-[14px] font-semibold leading-snug text-ink">{option.label}</h2>
      {option.pros?.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-success">Pros</p>
          <ul className="mt-1 space-y-1">
            {option.pros.map((item) => (
              <li key={item} className="text-[12px] leading-relaxed text-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {option.cons?.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">Cons</p>
          <ul className="mt-1 space-y-1">
            {option.cons.map((item) => (
              <li key={item} className="text-[12px] leading-relaxed text-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PivotSection({
  decision,
  pivotChoice,
  pivoting,
  onPivotChoice,
  onPivot
}: {
  decision: DecisionNode;
  pivotChoice?: string;
  pivoting: boolean;
  onPivotChoice: (id: string) => void;
  onPivot: () => void;
}): ReactElement {
  return (
    <section className="rounded-xl border border-border p-3">
      <p className="text-[12px] font-medium text-ink">Try another path</p>
      <p className="mt-0.5 text-[11px] text-muted">Branch reruns only downstream steps.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {decision.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onPivotChoice(option.id)}
            className={[
              "rounded-md px-2 py-1 text-[11px] font-medium",
              pivotChoice === option.id ? "bg-accent text-white" : "bg-canvas text-ink ring-1 ring-border"
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded-lg bg-ink py-2 text-[12px] font-semibold text-white disabled:opacity-50"
        disabled={pivoting || !pivotChoice}
        onClick={onPivot}
      >
        {pivoting ? "Branching…" : "Create branch"}
      </button>
    </section>
  );
}

function LessonSection({
  decision,
  lessonOpen,
  lessonBody,
  onToggle,
  onLessonBody,
  onReview,
  onSave
}: {
  decision: DecisionNode;
  lessonOpen: boolean;
  lessonBody: string;
  onToggle: () => void;
  onLessonBody: (value: string) => void;
  onReview: () => void;
  onSave: () => void;
}): ReactElement {
  return (
    <section>
      <button type="button" className="text-[11px] font-medium text-accent" onClick={onToggle}>
        {lessonOpen ? "Hide lesson" : "Add lesson note"}
      </button>
      {lessonOpen ? (
        <div className="mt-2 space-y-2">
          <textarea
            className="h-24 w-full resize-none rounded-xl border border-border bg-canvas px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/20"
            placeholder={`Why ${decisionLabel(decision)}?`}
            value={lessonBody}
            onChange={(event) => onLessonBody(event.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="flex-1 rounded-lg border border-border py-1.5 text-[11px]" onClick={onReview}>
              Mark reviewed
            </button>
            <button type="button" className="flex-1 rounded-lg bg-accent py-1.5 text-[11px] font-semibold text-white" onClick={onSave}>
              Save
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function wrap(embedded: boolean, children: ReactElement): ReactElement {
  if (embedded) {
    return <div className="side-panel flex min-h-0 flex-1 flex-col">{children}</div>;
  }
  return <aside className="side-panel flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-border bg-panel">{children}</aside>;
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
