import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

interface PanelChromeProps {
  side: "left" | "right";
  open: boolean;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  title?: string;
  header?: ReactNode;
  onOpenChange: (open: boolean) => void;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}

export function PanelChrome({
  side,
  open,
  width,
  minWidth = 240,
  maxWidth = 520,
  title,
  header,
  onOpenChange,
  onWidthChange,
  children
}: PanelChromeProps): ReactElement {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current) return;
      const delta = side === "left" ? event.clientX - startX.current : startX.current - event.clientX;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      onWidthChange(next);
    },
    [maxWidth, minWidth, onWidthChange, side]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  useEffect(() => () => onPointerUp(), [onPointerUp]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    dragging.current = true;
    startX.current = event.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  if (!open) {
    return (
      <div className={`relative flex h-full shrink-0 ${side === "left" ? "border-r border-border" : "border-l border-border"}`}>
        <button
          type="button"
          aria-label={`Open ${title ?? side} panel`}
          onClick={() => onOpenChange(true)}
          className={[
            "flex h-full w-9 items-center justify-center bg-panel text-muted transition hover:bg-canvas hover:text-ink",
            side === "left" ? "border-r border-border" : "border-l border-border"
          ].join(" ")}
        >
          <ChevronIcon side={side} open={false} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full shrink-0" style={{ width }}>
      <aside className={["side-panel flex h-full min-h-0 w-full flex-col bg-panel", side === "left" ? "border-r border-border" : "border-l border-border"].join(" ")}>
        {header ?? (
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2">
            <span className="truncate px-1 text-[11px] font-medium uppercase tracking-wide text-muted">{title}</span>
            <button
              type="button"
              aria-label={`Close ${title ?? side} panel`}
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted transition hover:bg-canvas hover:text-ink"
            >
              <ChevronIcon side={side} open />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onPointerDown={startResize}
        className={[
          "absolute top-0 z-20 h-full w-1 cursor-col-resize transition hover:bg-accent/40",
          side === "left" ? "right-0" : "left-0"
        ].join(" ")}
      />
    </div>
  );
}

function ChevronIcon({ side, open }: { side: "left" | "right"; open: boolean }): ReactElement {
  const points =
    side === "left"
      ? open
        ? "M15 6L9 12L15 18"
        : "M9 6L15 12L9 18"
      : open
        ? "M9 6L15 12L9 18"
        : "M15 6L9 12L15 18";

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
