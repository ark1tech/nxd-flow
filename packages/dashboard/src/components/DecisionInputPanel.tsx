import type { ReactElement } from "react";
import type { DecisionNode } from "@autopilot/shared";
import { decisionLabel } from "../hooks/useAutopilotState";

export function ClarificationCheckpointFooter({
  question,
  busy,
  selectedId,
  customText,
  onCustomText,
  onSelect,
  onClarify
}: {
  question: { recommendation: string; options: Array<{ id: string; label: string }> };
  busy: boolean;
  selectedId?: string;
  customText: string;
  onCustomText: (value: string) => void;
  onSelect: (optionId: string) => void;
  onClarify: (answer: string) => Promise<void>;
}): ReactElement {
  const selected = question.options.find((option) => option.id === selectedId);
  const isRecommended = selectedId === question.recommendation;

  const submit = (): void => {
    if (selectedId === "custom") {
      void onClarify(customText.trim());
      return;
    }
    if (!selectedId) return;
    void onClarify(selectedId);
  };

  return (
    <div className="shrink-0 border-t border-border bg-canvas/40 px-4 py-3">
      {selectedId === "custom" ? (
        <textarea
          className="mb-2 h-16 w-full resize-none rounded-xl border border-border bg-panel px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/20"
          placeholder="Describe your preference…"
          value={customText}
          onChange={(event) => onCustomText(event.target.value)}
        />
      ) : (
        <div className="rounded-xl bg-panel px-3 py-2 ring-1 ring-border">
          <p className="text-[10px] font-medium text-muted">{isRecommended ? "Pilot recommends" : "Selected"}</p>
          <p className="mt-0.5 text-[12px] font-medium text-ink">{selected?.label ?? "Pick an option in the graph"}</p>
        </div>
      )}
      <div className="mt-2.5 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy || !selectedId || (selectedId === "custom" && !customText.trim())}
          className="w-full rounded-xl bg-accent py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          onClick={submit}
        >
          {busy ? "Submitting…" : "Continue"}
        </button>
        {!isRecommended && selectedId ? (
          <button
            type="button"
            disabled={busy}
            className="w-full py-1 text-[11px] font-medium text-muted hover:text-ink"
            onClick={() => onSelect(question.recommendation)}
          >
            Reset to recommendation
          </button>
        ) : null}
      </div>
    </div>
  );
}

export type DecisionAnswerHandler = (
  id: string,
  mode: "approve" | "override",
  choice?: string,
  scope?: "once" | "context" | "global"
) => Promise<void>;

export function DecisionCheckpointFooter({
  decision,
  busy,
  selectedId,
  onSelect,
  onAnswer
}: {
  decision: DecisionNode;
  busy: boolean;
  selectedId?: string;
  onSelect: (optionId: string) => void;
  onAnswer: DecisionAnswerHandler;
}): ReactElement {
  const selected = decision.options.find((option) => option.id === selectedId);
  const isRecommended = selectedId === decision.choice;

  const submit = (): void => {
    if (isRecommended) {
      void onAnswer(decision.id, "approve");
      return;
    }
    if (!selectedId) return;
    void onAnswer(decision.id, "override", selectedId, "context");
  };

  return (
    <div className="shrink-0 border-t border-border bg-canvas/40 px-4 py-3">
      <div className="rounded-xl bg-panel px-3 py-2 ring-1 ring-border">
        <p className="text-[10px] font-medium text-muted">Pilot recommends</p>
        <p className="mt-0.5 text-[12px] font-medium text-ink">{decisionLabel(decision)}</p>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy || !selectedId}
          className="w-full rounded-xl bg-accent py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          onClick={submit}
        >
          {busy ? "Submitting…" : isRecommended ? "Approve recommendation" : `Confirm: ${selected?.label ?? "selection"}`}
        </button>
        {!isRecommended ? (
          <button
            type="button"
            disabled={busy}
            className="w-full py-1 text-[11px] font-medium text-muted hover:text-ink"
            onClick={() => onSelect(decision.choice)}
          >
            Reset to recommendation
          </button>
        ) : null}
      </div>
    </div>
  );
}
