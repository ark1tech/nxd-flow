import type { ReactElement } from "react";
import type { DashboardSnapshot } from "@autopilot/shared";
import { latestMission, tierWeight } from "../hooks/useAutopilotState";

interface TopBarProps {
  state: DashboardSnapshot;
  hasSession: boolean;
  connected: boolean;
  running?: boolean;
}

export function TopBar({ state, hasSession, connected, running }: TopBarProps): ReactElement {
  const mission = latestMission(state);
  const debt = state.decisions.filter((decision) => !decision.reviewed).reduce((sum, decision) => sum + tierWeight(decision.tier), 0);

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[13px] font-semibold text-ink">Autopilot</h1>
        {hasSession ? (
          <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
            {formatStatus(mission?.status, running)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted">
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
        <span className="flex items-center gap-1.5 font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "animate-pulse bg-warning"}`} />
          <span className={connected ? "text-success" : "text-warning"}>{connected ? "Connected" : "Reconnecting"}</span>
        </span>
      </div>
    </header>
  );
}

function formatStatus(status?: string, running?: boolean): string {
  if (running && status === "running") return "Running";
  if (!status) return "Ready";
  if (status === "waiting") return "Needs you";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
