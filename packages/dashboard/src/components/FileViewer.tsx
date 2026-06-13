import type { ReactElement } from "react";

interface FileViewerProps {
  path?: string;
  content?: string;
  loading?: boolean;
  onClose: () => void;
}

export function FileViewer({ path, content, loading, onClose }: FileViewerProps): ReactElement | null {
  if (!path) return null;

  return (
    <section className="flex min-h-0 max-h-[42%] flex-1 flex-col border-t border-border bg-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <p className="truncate font-mono text-[11px] text-ink">{path}</p>
        <button type="button" onClick={onClose} className="shrink-0 text-[11px] font-medium text-muted hover:text-ink">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#fafafa] px-3 py-2">
        {loading ? (
          <p className="text-[12px] text-muted">Loading…</p>
        ) : (
          <pre className="font-mono text-[11px] leading-5 text-ink">
            <code>{content ?? ""}</code>
          </pre>
        )}
      </div>
    </section>
  );
}
