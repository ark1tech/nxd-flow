import type { ReactElement } from "react";
import type { DashboardSnapshot } from "@autopilot/shared";
import { latestMission, tierWeight } from "../hooks/useAutopilotState";
import type { ThemeMode } from "../hooks/useTheme";

interface TopBarProps {
  state: DashboardSnapshot;
  hasSession: boolean;
  connected: boolean;
  running?: boolean;
  themeMode: ThemeMode;
  isDark: boolean;
  onThemeChange: (mode: ThemeMode) => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export function TopBar({
  state,
  hasSession,
  connected,
  running,
  themeMode,
  isDark,
  onThemeChange,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight
}: TopBarProps): ReactElement {
  const mission = latestMission(state);
  const debt = state.decisions.filter((decision) => !decision.reviewed).reduce((sum, decision) => sum + tierWeight(decision.tier), 0);

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-panel px-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={leftOpen ? "Hide left panel" : "Show left panel"}
          onClick={onToggleLeft}
          className="rounded-md p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
        >
          <PanelToggleIcon side="left" open={leftOpen} />
        </button>
        <h1 className="text-[13px] font-semibold text-ink">Autopilot</h1>
        {hasSession ? (
          <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
            {formatStatus(mission?.status, running)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted">
        {hasSession ? (
          <>
            <span>
              <span className="tabular-nums text-ink">{state.decisions.length}</span> decisions
            </span>
            <span>
              debt <span className="tabular-nums text-ink">{debt}</span>
            </span>
          </>
        ) : null}
        <ThemeToggle mode={themeMode} isDark={isDark} onChange={onThemeChange} />
        <span className="flex items-center gap-1.5 font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "animate-pulse bg-warning"}`} />
          <span className={connected ? "text-success" : "text-warning"}>{connected ? "Connected" : "Reconnecting"}</span>
        </span>
        <button
          type="button"
          aria-label={rightOpen ? "Hide right panel" : "Show right panel"}
          onClick={onToggleRight}
          className="rounded-md p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
        >
          <PanelToggleIcon side="right" open={rightOpen} />
        </button>
      </div>
    </header>
  );
}

function ThemeToggle({
  mode,
  isDark,
  onChange
}: {
  mode: ThemeMode;
  isDark: boolean;
  onChange: (mode: ThemeMode) => void;
}): ReactElement {
  const cycle = (): void => {
    if (mode === "system") onChange(isDark ? "light" : "dark");
    else if (mode === "dark") onChange("light");
    else onChange("dark");
  };

  return (
    <button
      type="button"
      aria-label={`Theme: ${mode}`}
      onClick={cycle}
      className="rounded-md px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-canvas hover:text-ink"
    >
      {mode === "system" ? "Auto" : isDark ? "Dark" : "Light"}
    </button>
  );
}

function PanelToggleIcon({ side, open }: { side: "left" | "right"; open: boolean }): ReactElement {
  if (side === "left") {
    return open ? (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </svg>
    ) : (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16M12 12h6" />
      </svg>
    );
  }

  return open ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16M6 12h6" />
    </svg>
  );
}

function formatStatus(status?: string, running?: boolean): string {
  if (running && status === "running") return "Running";
  if (!status) return "Ready";
  if (status === "waiting") return "Needs you";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
