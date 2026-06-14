import { memo, type ReactElement } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { OptionNodeData } from "../lib/layout";

function OptionNodeCard({ data }: NodeProps<OptionNodeData>): ReactElement {
  return (
    <div
      className={[
        "w-52 rounded-xl border px-3 py-2 shadow-card transition",
        data.selected ? "border-accent bg-accent/5 ring-2 ring-accent/30" : "border-border bg-panel",
        data.recommended ? "border-accent/40" : ""
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Option</span>
        {data.recommended ? <span className="text-[9px] font-semibold text-accent">Recommended</span> : null}
      </div>
      <p className="line-clamp-3 text-[11px] font-medium leading-snug text-ink">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
    </div>
  );
}

export default memo(OptionNodeCard);
