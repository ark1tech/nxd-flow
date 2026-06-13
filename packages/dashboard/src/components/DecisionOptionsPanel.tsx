import type { ReactElement } from "react";
import type { DecisionNode, DecisionOption } from "@autopilot/shared";
import { decisionLabel } from "../hooks/useAutopilotState";

export function DecisionOptionsPanel({ decision }: { decision: DecisionNode }): ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-muted">{decision.rationale}</p>
      {decision.options.map((option) => (
        <OptionCard key={option.id} option={option} recommended={option.id === decision.choice} />
      ))}
    </div>
  );
}

function OptionCard({ option, recommended }: { option: DecisionOption; recommended: boolean }): ReactElement {
  return (
    <div className={["rounded-xl border p-3", recommended ? "border-accent bg-accent/5" : "border-border bg-canvas/50"].join(" ")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-ink">{option.label}</p>
        {recommended ? <span className="text-[10px] font-semibold text-accent">Recommended</span> : null}
      </div>
      {option.pros?.length ? (
        <div className="mt-1.5">
          <p className="text-[10px] font-medium text-success">Pros</p>
          <ul className="mt-0.5 list-disc pl-4 text-[11px] text-muted">
            {option.pros.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {option.cons?.length ? (
        <div className="mt-1.5">
          <p className="text-[10px] font-medium text-warning">Cons</p>
          <ul className="mt-0.5 list-disc pl-4 text-[11px] text-muted">
            {option.cons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function RecommendedLabel({ decision }: { decision: DecisionNode }): ReactElement {
  return (
    <p className="text-[12px]">
      <span className="text-muted">Chosen </span>
      <span className="font-medium text-ink">{decisionLabel(decision)}</span>
    </p>
  );
}
