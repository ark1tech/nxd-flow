import { memo, type ReactElement } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { DagNodeData } from "../lib/layout";

const tierStyles: Record<string, string> = {
  low: "border-success/30 bg-white",
  medium: "border-warning/40 bg-white",
  high: "border-danger/40 bg-white",
  critical: "border-danger/60 bg-white"
};

function DecisionNodeCard({ data }: NodeProps<DagNodeData>): ReactElement {
  const tierClass = tierStyles[data.tier] ?? "border-border bg-white";
  const pending = data.pending;
  const changed = data.changed;
  const dimmed = data.dimmed;

  return (
    <div
      className={[
        "w-56 rounded-2xl border px-3.5 py-2.5 shadow-card transition",
        tierClass,
        pending ? "animate-pulseSoft border-accent ring-2 ring-accent/20" : "",
        changed ? "ring-2 ring-accent shadow-float" : "",
        dimmed ? "opacity-35" : ""
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted">{data.tier}</span>
        {pending ? <span className="text-[10px] font-medium text-accent">Working…</span> : null}
        {changed ? <span className="text-[10px] font-medium text-accent">Changed</span> : null}
        {data.reviewed ? <span className="text-[10px] font-medium text-success">Reviewed</span> : null}
      </div>
      <p className="line-clamp-2 text-[12px] font-medium leading-snug text-ink">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
    </div>
  );
}

export default memo(DecisionNodeCard);
