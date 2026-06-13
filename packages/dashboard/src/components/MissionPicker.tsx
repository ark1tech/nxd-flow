import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { MissionSummary } from "@autopilot/shared";

interface MissionPickerProps {
  missions: MissionSummary[];
  activeMissionId?: string;
  onSelect: (missionId: string) => void;
  onNewMission: () => void;
  onClearAll?: () => void;
}

export function MissionPicker({ missions, activeMissionId, onSelect, onNewMission, onClearAll }: MissionPickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const active = missions.find((mission) => mission.id === activeMissionId);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative shrink-0 border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-canvas/80"
      >
        <MissionDot status={active?.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{active?.idea ?? "No mission selected"}</p>
          <p className="truncate text-[11px] text-muted">
            {active ? formatMissionMeta(active) : `${missions.length} saved · pick or start one`}
          </p>
        </div>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 flex max-h-[min(420px,calc(100vh-120px))] flex-col border-b border-border bg-panel shadow-panel">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-[12px] font-semibold text-ink">Missions</p>
            <div className="flex items-center gap-2">
              {onClearAll && missions.length > 0 ? (
                <button type="button" onClick={() => { onClearAll(); setOpen(false); }} className="text-[11px] font-medium text-danger hover:opacity-80">
                  Clear all
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-medium text-muted hover:text-ink">
                Close
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {missions.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-muted">
                No saved missions. Describe a feature in the composer and press Run.
              </p>
            ) : (
              missions.map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => {
                    onSelect(mission.id);
                    setOpen(false);
                  }}
                  className={[
                    "mb-0.5 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    mission.id === activeMissionId ? "bg-accent/8" : "hover:bg-canvas"
                  ].join(" ")}
                >
                  <MissionDot status={mission.status} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12px] font-medium leading-snug text-ink">{mission.idea}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{formatMissionMeta(mission)}</p>
                  </div>
                  <StatusPill status={mission.status} />
                </button>
              ))
            )}
          </div>

          <div className="shrink-0 border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                onNewMission();
                setOpen(false);
              }}
              className="w-full rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:bg-accent-hover"
            >
              New mission
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MissionDot({ status }: { status?: MissionSummary["status"] }): ReactElement {
  const color =
    status === "running"
      ? "bg-accent animate-pulse"
      : status === "waiting"
        ? "bg-warning"
        : status === "completed"
          ? "bg-success"
          : status === "failed"
            ? "bg-danger"
            : "bg-border-strong";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function StatusPill({ status }: { status: MissionSummary["status"] }): ReactElement {
  const styles: Record<MissionSummary["status"], string> = {
    created: "text-muted",
    running: "text-accent",
    waiting: "text-warning",
    completed: "text-success",
    failed: "text-danger"
  };
  const label = status === "waiting" ? "Needs you" : status;
  return <span className={`shrink-0 pt-0.5 text-[10px] font-medium capitalize ${styles[status]}`}>{label}</span>;
}

function formatMissionMeta(mission: MissionSummary): string {
  const parts = [`${mission.decisionCount} decisions`, relativeTime(mission.updatedAt)];
  if (mission.scratchExists) parts.push("worktree");
  return parts.join(" · ");
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
