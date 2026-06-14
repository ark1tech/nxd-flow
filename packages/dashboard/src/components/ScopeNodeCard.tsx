import { memo, type ReactElement } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { ScopeNodeData } from "../lib/layoutScope";

function ScopeNodeCard({ data }: NodeProps<ScopeNodeData>): ReactElement {
  return (
    <div
      className={[
        "w-56 rounded-2xl border border-warning/40 bg-panel px-3.5 py-2.5 shadow-card transition",
        data.needsInput ? "border-accent ring-2 ring-accent/35 shadow-float" : "",
        data.selected ? "ring-2 ring-accent" : ""
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Scope check</span>
        {data.needsInput ? <span className="text-[10px] font-semibold text-accent">Input needed</span> : null}
      </div>
      <p className="line-clamp-2 text-[12px] font-medium leading-snug text-ink">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
    </div>
  );
}

export default memo(ScopeNodeCard);
