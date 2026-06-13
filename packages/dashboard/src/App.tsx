import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Branch, DecisionNode } from "@autopilot/shared";
import { useAutopilotState, waitingDecision } from "./hooks/useAutopilotState";
import { fetchWorktreeFile, useWorktree } from "./hooks/useWorktree";
import { useFileGraph } from "./hooks/useFileGraph";
import { TopBar } from "./components/TopBar";
import { LeftSidebar } from "./components/LeftSidebar";
import { DagCanvas } from "./components/DagCanvas";
import { FileGraphCanvas } from "./components/FileGraphCanvas";
import { Inspector } from "./components/Inspector";
import { HarnessInspector } from "./components/HarnessInspector";
import { SkillsSheet } from "./components/SkillsSheet";
import { FileViewer } from "./components/FileViewer";

type CenterView = "decisions" | "files";
type RightPanel = "decision" | "harness";

export function App(): ReactElement {
  const { state, missions, connected, sessionMissionId, switchSession, clearMissions } = useAutopilotState();
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>();
  const [pivoting, setPivoting] = useState(false);
  const [compareBranchId, setCompareBranchId] = useState<string>();
  const [worktreeBranchId, setWorktreeBranchId] = useState<string>();
  const [selectedFilePath, setSelectedFilePath] = useState<string>();
  const [fileContent, setFileContent] = useState<string>();
  const [fileLoading, setFileLoading] = useState(false);
  const [worktreeRefreshKey, setWorktreeRefreshKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<string>();
  const [centerView, setCenterView] = useState<CenterView>("decisions");
  const [rightPanel, setRightPanel] = useState<RightPanel>("decision");
  const [selectedHarnessId, setSelectedHarnessId] = useState<string>();
  const [skillsOpen, setSkillsOpen] = useState(false);

  const mission = state.missions[0];
  const running = starting || mission?.status === "running";
  const waiting = waitingDecision(state);
  const compareBranch = useMemo(
    () => state.branches.find((branch: Branch) => branch.id === compareBranchId),
    [state.branches, compareBranchId]
  );
  const selectedDecision = state.decisions.find((decision: DecisionNode) => decision.id === selectedDecisionId);
  const graphRefreshKey = worktreeRefreshKey + state.decisions.length + state.activities.length;
  const { snapshot: worktree, loading: worktreeLoading, refresh: refreshWorktree } = useWorktree(
    sessionMissionId,
    worktreeBranchId,
    graphRefreshKey
  );
  const { graph: fileGraph, loading: fileGraphLoading } = useFileGraph(sessionMissionId, worktreeBranchId, graphRefreshKey);

  useEffect(() => {
    if (waiting) setSelectedDecisionId(waiting.id);
  }, [waiting?.id]);

  useEffect(() => {
    if (!pivoting) return;
    const latest = state.branches.at(-1);
    if (latest?.status === "completed") {
      setCompareBranchId(latest.id);
      setPivoting(false);
    }
    if (latest?.status === "failed") setPivoting(false);
  }, [state.branches, pivoting]);

  useEffect(() => {
    if (!sessionMissionId || !selectedFilePath) {
      setFileContent(undefined);
      return;
    }
    setFileLoading(true);
    void fetchWorktreeFile(sessionMissionId, selectedFilePath, worktreeBranchId)
      .then((file) => setFileContent(file.content))
      .catch(() => setFileContent("// File unavailable"))
      .finally(() => setFileLoading(false));
  }, [sessionMissionId, selectedFilePath, worktreeBranchId]);

  async function startMission(idea: string, live: boolean): Promise<boolean> {
    setRunError(undefined);
    setStarting(true);
    setSelectedDecisionId(undefined);
    setCompareBranchId(undefined);
    setSelectedFilePath(undefined);
    setWorktreeBranchId(undefined);
    setCenterView("decisions");
    setRightPanel("decision");
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, live, background: true })
      });
      const raw = await res.text();
      const payload = (() => {
        try {
          return JSON.parse(raw) as { mission?: { id: string }; error?: string };
        } catch {
          return { error: raw };
        }
      })();
      if (!res.ok) {
        throw new Error(parseApiError(payload.error ?? raw));
      }
      if (!payload.mission?.id) {
        throw new Error("Mission did not start. Is the engine running on port 4317?");
      }
      await switchSession(payload.mission.id);
      setWorktreeRefreshKey((value) => value + 1);
      return true;
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Mission failed to start");
      return false;
    } finally {
      setStarting(false);
    }
  }

  async function clarify(answer: string): Promise<void> {
    if (!sessionMissionId) return;
    await fetch(`/api/missions/${sessionMissionId}/clarify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer, background: true })
    });
    setWorktreeRefreshKey((value) => value + 1);
  }

  async function answer(id: string, mode: "approve" | "override", choice?: string, scope?: "once" | "context" | "global"): Promise<void> {
    await fetch(`/api/decisions/${id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, choice, scope, background: true })
    });
    setWorktreeRefreshKey((value) => value + 1);
  }

  async function pivot(id: string, choice: string): Promise<void> {
    setPivoting(true);
    await fetch(`/api/decisions/${id}/pivot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choice, background: true })
    });
    setWorktreeRefreshKey((value) => value + 1);
  }

  async function review(id: string): Promise<void> {
    await fetch(`/api/decisions/${id}/review`, { method: "POST" });
  }

  async function saveLesson(id: string, body: string): Promise<void> {
    await fetch(`/api/decisions/${id}/lesson`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body })
    });
  }

  async function handleSelectMission(missionId: string): Promise<void> {
    setSelectedDecisionId(undefined);
    setCompareBranchId(undefined);
    setSelectedFilePath(undefined);
    setWorktreeBranchId(undefined);
    await switchSession(missionId);
    setWorktreeRefreshKey((value) => value + 1);
  }

  function focusComposer(): void {
    document.querySelector<HTMLTextAreaElement>("[data-autopilot-composer]")?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <TopBar
        state={state}
        hasSession={Boolean(sessionMissionId)}
        connected={connected}
        running={running || pivoting}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_300px]">
        <LeftSidebar
          state={state}
          missions={missions}
          sessionMissionId={sessionMissionId}
          running={running || pivoting}
          branches={state.branches}
          worktree={worktree}
          worktreeLoading={worktreeLoading}
          selectedFilePath={selectedFilePath}
          worktreeRootKey={worktreeBranchId ?? "main"}
          onSelectMission={(missionId) => void handleSelectMission(missionId)}
          onNewMission={focusComposer}
          onClearMissions={() => void clearMissions()}
          runError={runError}
          onStart={startMission}
          onSelectDecision={setSelectedDecisionId}
          onAnswer={answer}
          onClarify={clarify}
          onOpenHarness={() => setRightPanel("harness")}
          onSelectFile={(path) => {
            setSelectedFilePath(path);
            setCenterView("files");
          }}
          onRefreshWorktree={() => {
            setWorktreeRefreshKey((value) => value + 1);
            void refreshWorktree();
          }}
          onSelectWorktreeRoot={(branchId) => {
            setWorktreeBranchId(branchId);
            setSelectedFilePath(undefined);
            setWorktreeRefreshKey((value) => value + 1);
          }}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-1 border-b border-border bg-panel px-2 py-1.5">
            <CenterTab active={centerView === "decisions"} onClick={() => setCenterView("decisions")}>
              Decision graph
            </CenterTab>
            <CenterTab active={centerView === "files"} onClick={() => setCenterView("files")}>
              File graph
            </CenterTab>
          </div>
          {centerView === "decisions" ? (
            <DagCanvas
              state={state}
              compareBranch={compareBranchId ? compareBranch : undefined}
              onSelectDecision={(id) => {
                setSelectedDecisionId(id);
                setRightPanel("decision");
              }}
              selectedDecisionId={selectedDecisionId}
              compact={Boolean(selectedFilePath)}
            />
          ) : (
            <FileGraphCanvas
              graph={fileGraph}
              loading={fileGraphLoading}
              onSelectFile={setSelectedFilePath}
              compact={Boolean(selectedFilePath)}
            />
          )}
          <FileViewer
            path={selectedFilePath}
            content={fileContent}
            loading={fileLoading}
            onClose={() => setSelectedFilePath(undefined)}
          />
        </div>
        <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-border bg-panel">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <div className="flex gap-1">
              <RightTab active={rightPanel === "decision"} onClick={() => setRightPanel("decision")}>
                Decision
              </RightTab>
              <RightTab active={rightPanel === "harness"} onClick={() => setRightPanel("harness")}>
                Harness
              </RightTab>
            </div>
            <button
              type="button"
              aria-label="Skills settings"
              className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink"
              onClick={() => setSkillsOpen(true)}
            >
              <GearIcon />
            </button>
          </div>
          {rightPanel === "harness" ? (
            <HarnessInspector
              records={state.harnessRecords}
              selectedRecordId={selectedHarnessId}
              onSelectRecord={setSelectedHarnessId}
            />
          ) : (
            <Inspector
              embedded
              state={state}
              selectedDecision={selectedDecision}
              compareBranch={compareBranchId ? compareBranch : undefined}
              pivoting={pivoting}
              onPivot={pivot}
              onReview={review}
              onSaveLesson={saveLesson}
              onClose={() => setSelectedDecisionId(undefined)}
            />
          )}
        </aside>
        <SkillsSheet open={skillsOpen} onClose={() => setSkillsOpen(false)} />
      </div>
    </div>
  );
}

function RightTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-2.5 py-1 text-[11px] font-medium",
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GearIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function CenterTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-2.5 py-1 text-[11px] font-medium",
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function parseApiError(raw: string): string {
  const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.includes("No test files found")) {
    return "Verification failed: no tests found in the scratch worktree.";
  }
  if (stripped.includes("Command failed")) {
    const match = stripped.match(/Error: ([^<]+)/);
    return match?.[1]?.slice(0, 180) ?? "Engine error while running the mission.";
  }
  return stripped.slice(0, 180) || "Mission failed to start";
}
