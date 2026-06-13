import type { ReactElement } from "react";

interface ComposerProps {
  draft: string;
  live: boolean;
  running: boolean;
  error?: string;
  onDraftChange: (value: string) => void;
  onLiveChange: (value: boolean) => void;
  onRun: () => void;
}

export function Composer({
  draft,
  live,
  running,
  error,
  onDraftChange,
  onLiveChange,
  onRun
}: ComposerProps): ReactElement {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!running && draft.trim()) onRun();
    }
  }

  return (
    <div className="shrink-0 border-t border-border p-3">
      {error ? (
        <div className="mb-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[11px] leading-relaxed text-danger">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-canvas focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/20">
        <textarea
          className="block max-h-28 min-h-[64px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-muted/80"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a feature…"
          disabled={running}
          data-autopilot-composer
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
          <label
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted"
            title="Off = fast deterministic mock (recommended for demos). On = real Cursor SDK agents in the scratch worktree (requires CURSOR_API_KEY)."
          >
            <input
              type="checkbox"
              checked={live}
              onChange={(event) => onLiveChange(event.target.checked)}
              disabled={running}
              className="rounded border-border-strong text-accent focus:ring-accent/30"
            />
            <span>Live agents</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] text-muted sm:inline">Enter to run</span>
            <button
              type="button"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40"
              onClick={onRun}
              disabled={running || !draft.trim()}
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
