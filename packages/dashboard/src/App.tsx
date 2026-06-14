import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Branch } from "@autopilot/shared";
import { useAutopilotState, waitingDecision } from "./hooks/useAutopilotState";
import { usePanelLayout } from "./hooks/usePanelLayout";
import { useTheme } from "./hooks/useTheme";
import { fetchWorktreeFile, useWorktree } from "./hooks/useWorktree";
import { useFileGraph } from "./hooks/useFileGraph";
import {
  activeClarificationQuestion,
  optionGraphId,
  pickedOptionIdFromSelection,
  pickedScopeOptionIdFromSelection,
  resolveGraphSelection,
  scopeOptionGraphId
} from "./lib/graphNodes";
import { TopBar } from "./components/TopBar";
import { LeftSidebar } from "./components/LeftSidebar";
import { DagCanvas } from "./components/DagCanvas";
import { FileGraphCanvas } from "./components/FileGraphCanvas";
import { PreviewPane } from "./components/PreviewPane";
import { Inspector } from "./components/Inspector";
import { HarnessInspector } from "./components/HarnessInspector";
import { SkillsSheet } from "./components/SkillsSheet";
import { FileViewer } from "./components/FileViewer";
import { PanelChrome } from "./components/PanelChrome";

type CenterView = "decisions" | "files" | "preview";
type RightPanel = "decision" | "harness";

export function App(): ReactElement {
  const { state, missions, connected, sessionMissionId, switchSession, clearMissions } = useAutopilotState();
  const { layout, setLeftOpen, setRightOpen, setLeftWidth, setRightWidth } = usePanelLayout();
  const { mode, setMode, isDark } = useTheme();
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string>();
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
  const clarifying = Boolean(state.clarification && mission?.status === "waiting" && !waiting);
  const scopeQuestion = activeClarificationQuestion(state.clarification);
  const compareBranch = useMemo(
    () => state.branches.find((branch: Branch) => branch.id === compareBranchId),
    [state.branches, compareBranchId]
  );
  const graphSelection = useMemo(
    () => resolveGraphSelection(state.decisions, state.clarification, selectedGraphNodeId),
    [state.decisions, state.clarification, selectedGraphNodeId]
  );
  const pickedOptionId = pickedOptionIdFromSelection(graphSelection, waiting?.choice);
  const pickedScopeOptionId = pickedScopeOptionIdFromSelection(graphSelection, scopeQuestion?.recommendation);
  const isPicking = Boolean(
    waiting &&
      (graphSelection?.kind === "decision" || graphSelection?.kind === "option") &&
      graphSelection.decision.id === waiting.id
  );
  const isScopePicking = clarifying;
  const graphRefreshKey =
    worktreeRefreshKey +
    state.decisions.map((decision) => `${decision.id}:${decision.status}`).join(",") +
    state.pendingNodes.map((node) => node.id).join(",") +
    state.activities.length +
    (state.clarification?.currentIndex ?? 0);
  const { snapshot: worktree, loading: worktreeLoading, refresh: refreshWorktree } = useWorktree(
    sessionMissionId,
    worktreeBranchId,
    graphRefreshKey
  );
  const { graph: fileGraph, loading: fileGraphLoading } = useFileGraph(sessionMissionId, worktreeBranchId, graphRefreshKey);

  useEffect(() => {
    if (waiting) {
      setSelectedGraphNodeId(waiting.id);
      setCenterView("decisions");
    }
  }, [waiting?.id]);

  useEffect(() => {
    if (!clarifying || !scopeQuestion) return;
    setCenterView("decisions");
    setRightPanel("decision");
    setSelectedGraphNodeId((current) => current ?? scopeOptionGraphId(scopeQuestion.recommendation));
  }, [clarifying, scopeQuestion?.recommendation, state.clarification?.currentIndex]);

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

  async function continueMission(message: string, live: boolean): Promise<boolean> {
    if (!sessionMissionId) return false;
    setRunError(undefined);
    setStarting(true);
    try {
      const res = await fetch(`/api/missions/${sessionMissionId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message, live, background: true })
      });
      const raw = await res.text();
      const payload = (() => {
        try {
          return JSON.parse(raw) as { error?: string };
        } catch {
          return { error: raw };
        }
      })();
      if (!res.ok) throw new Error(parseApiError(payload.error ?? raw));
      setWorktreeRefreshKey((value) => value + 1);
      return true;
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Follow-up failed");
      return false;
    } finally {
      setStarting(false);
    }
  }

  async function startMission(idea: string, live: boolean): Promise<boolean> {
    setRunError(undefined);
    setStarting(true);
    setSelectedGraphNodeId(undefined);
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
    setSelectedGraphNodeId(undefined);
    setCompareBranchId(undefined);
    setSelectedFilePath(undefined);
    setWorktreeBranchId(undefined);
    await switchSession(missionId);
    setWorktreeRefreshKey((value) => value + 1);
  }

  function focusComposer(): void {
    document.querySelector<HTMLTextAreaElement>("[data-autopilot-composer]")?.focus();
  }

  const rightHeader = (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2">
      <div className="flex gap-1">
        <RightTab active={rightPanel === "decision"} onClick={() => setRightPanel("decision")} highlight={clarifying || Boolean(waiting)}>
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
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <TopBar
        state={state}
        hasSession={Boolean(sessionMissionId)}
        connected={connected}
        running={running || pivoting}
        themeMode={mode}
        isDark={isDark}
        onThemeChange={setMode}
        leftOpen={layout.leftOpen}
        rightOpen={layout.rightOpen}
        onToggleLeft={() => setLeftOpen(!layout.leftOpen)}
        onToggleRight={() => setRightOpen(!layout.rightOpen)}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PanelChrome
          side="left"
          open={layout.leftOpen}
          width={layout.leftWidth}
          title="Agent"
          onOpenChange={setLeftOpen}
          onWidthChange={setLeftWidth}
        >
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
            onContinue={continueMission}
            onSelectDecision={(id) => {
              setSelectedGraphNodeId(id);
              setCenterView("decisions");
              setRightPanel("decision");
            }}
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
        </PanelChrome>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-x border-border">
          <div className="flex shrink-0 items-center gap-1 border-b border-border bg-panel px-2 py-1.5">
            <CenterTab active={centerView === "decisions"} onClick={() => setCenterView("decisions")}>
              Decision graph
            </CenterTab>
            <CenterTab active={centerView === "files"} onClick={() => setCenterView("files")}>
              File graph
            </CenterTab>
            <CenterTab active={centerView === "preview"} onClick={() => setCenterView("preview")}>
              Live preview
            </CenterTab>
            {compareBranchId ? (
              <button
                type="button"
                className="ml-auto rounded-md px-2 py-1 text-[11px] text-muted hover:bg-canvas hover:text-ink"
                onClick={() => setCompareBranchId(undefined)}
              >
                Close branch compare
              </button>
            ) : null}
          </div>
          {centerView === "decisions" ? (
            <DagCanvas
              state={state}
              compareBranch={compareBranchId ? compareBranch : undefined}
              clarifying={clarifying}
              onSelectGraphNode={(id) => {
                setSelectedGraphNodeId(id);
                setCenterView("decisions");
                setRightPanel("decision");
              }}
              selectedGraphNodeId={selectedGraphNodeId}
              waitingDecisionId={waiting?.id}
              compact={Boolean(selectedFilePath)}
            />
          ) : centerView === "files" ? (
            <FileGraphCanvas
              graph={fileGraph}
              loading={fileGraphLoading}
              onSelectFile={setSelectedFilePath}
              compact={Boolean(selectedFilePath)}
            />
          ) : (
            <PreviewPane
              missionId={sessionMissionId}
              branchId={worktreeBranchId}
              refreshKey={graphRefreshKey}
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

        <PanelChrome
          side="right"
          open={layout.rightOpen}
          width={layout.rightWidth}
          title="Inspector"
          header={rightHeader}
          onOpenChange={setRightOpen}
          onWidthChange={setRightWidth}
        >
          {rightPanel === "harness" ? (
            <div className="side-panel flex min-h-0 flex-1 flex-col">
              <HarnessInspector
                records={state.harnessRecords}
                selectedRecordId={selectedHarnessId}
                onSelectRecord={setSelectedHarnessId}
              />
            </div>
          ) : (
            <Inspector
              embedded
              state={state}
              selection={graphSelection}
              compareBranch={compareBranchId ? compareBranch : undefined}
              pivoting={pivoting}
              busy={running || pivoting}
              isPicking={isPicking}
              isScopePicking={isScopePicking}
              pickedOptionId={pickedOptionId}
              pickedScopeOptionId={pickedScopeOptionId}
              onAnswer={answer}
              onClarify={clarify}
              onPickOption={(optionId) => {
                if (!waiting) return;
                setSelectedGraphNodeId(optionGraphId(waiting.id, optionId));
              }}
              onPickScopeOption={(optionId) => setSelectedGraphNodeId(scopeOptionGraphId(optionId))}
              onPivot={pivot}
              onReview={review}
              onSaveLesson={saveLesson}
              onClose={() => setSelectedGraphNodeId(undefined)}
            />
          )}
        </PanelChrome>
        <SkillsSheet open={skillsOpen} onClose={() => setSkillsOpen(false)} />
      </div>
    </div>
  );
}

function RightTab({
  active,
  highlight = false,
  onClick,
  children
}: {
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
  children: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-md px-2.5 py-1 text-[11px] font-medium",
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"
      ].join(" ")}
    >
      {children}
      {highlight && !active ? <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-warning" /> : null}
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
