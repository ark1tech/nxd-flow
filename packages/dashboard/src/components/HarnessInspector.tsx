import type { ReactElement } from "react";
import type { HarnessRecord } from "@autopilot/shared";

interface HarnessInspectorProps {
  records: HarnessRecord[];
  selectedRecordId?: string;
  onSelectRecord: (id?: string) => void;
}

export function HarnessInspector({ records, selectedRecordId, onSelectRecord }: HarnessInspectorProps): ReactElement {
  const selected = records.find((record) => record.id === selectedRecordId) ?? records.at(-1);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
      <section>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Agent calls ({records.length})</p>
        <div className="mt-1.5 space-y-1">
          {records.length === 0 ? (
            <p className="text-[11px] text-muted">No harness records yet.</p>
          ) : (
            records.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRecord(record.id)}
                className={[
                  "w-full rounded-xl border px-2.5 py-2 text-left transition",
                  selected?.id === record.id ? "border-accent bg-accent/5" : "border-border hover:bg-canvas"
                ].join(" ")}
              >
                <p className="text-[11px] font-medium capitalize text-ink">
                  {record.role} · {record.stepName}
                  {record.fallbackUsed ? " · mock" : ""}
                </p>
                <p className="text-[10px] text-muted">{record.model} · {record.durationMs}ms</p>
              </button>
            ))
          )}
        </div>
      </section>

      {selected ? (
        <section className="rounded-xl border border-border p-2.5 space-y-2">
          <MetaRow label="Role" value={selected.role} />
          <MetaRow label="Model" value={selected.model} />
          <MetaRow label="Tools" value={selected.tools.join(", ") || "none"} />
          <div>
            <p className="text-[10px] font-medium text-muted">Prompt</p>
            <pre className="mt-1 max-h-28 overflow-auto rounded-xl bg-canvas p-2 text-[10px] leading-relaxed text-ink whitespace-pre-wrap">{selected.prompt}</pre>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted">Skills injected</p>
            <pre className="mt-1 max-h-20 overflow-auto rounded-xl bg-canvas p-2 text-[10px] leading-relaxed text-muted whitespace-pre-wrap">{selected.skills || "—"}</pre>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted">Response</p>
            <pre className="mt-1 max-h-32 overflow-auto rounded-xl bg-canvas p-2 text-[10px] leading-relaxed text-ink whitespace-pre-wrap">{selected.rawResponse.slice(0, 1200)}</pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <p className="text-[11px] text-ink">{value}</p>
    </div>
  );
}
