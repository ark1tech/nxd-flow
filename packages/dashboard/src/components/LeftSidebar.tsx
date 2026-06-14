import type { ReactElement } from "react";
import { useState } from "react";
import type { Branch, DashboardSnapshot, MissionSummary } from "@autopilot/shared";
import type { WorktreeSnapshot } from "@autopilot/shared";
import { ChatRail } from "./ChatRail";
import { Composer } from "./Composer";
import { MissionPicker } from "./MissionPicker";
import { WorktreeExplorer } from "./WorktreeExplorer";

type SidebarTab = "agent" | "files";

interface LeftSidebarProps {
  state: DashboardSnapshot;
  missions: MissionSummary[];
  sessionMissionId?: string;
  running: boolean;
  runError?: string;
  branches: Branch[];
  worktree?: WorktreeSnapshot;
  worktreeLoading: boolean;
  selectedFilePath?: string;
  worktreeRootKey?: string;
  onSelectMission: (missionId: string) => void;
  onNewMission: () => void;
  onClearMissions: () => void;
  onStart: (idea: string, live: boolean) => Promise<boolean>;
  onContinue?: (message: string, live: boolean) => Promise<boolean>;
  onSelectDecision: (id: string) => void;
  onAnswer: (id: string, mode: "approve" | "override", choice?: string, scope?: "once" | "context" | "global") => Promise<void>;
  onClarify: (answer: string) => Promise<void>;
  onOpenHarness?: () => void;
  selectedDecisionId?: string;
  onSelectFile: (path: string) => void;
  onRefreshWorktree: () => void;
  onSelectWorktreeRoot: (branchId?: string) => void;
}

export function LeftSidebar(props: LeftSidebarProps): ReactElement {
  const [tab, setTab] = useState<SidebarTab>("agent");
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(true);

  async function handleRun(): Promise<void> {
    if (!draft.trim() || props.running) return;
    const ok =
      props.sessionMissionId && props.onContinue
        ? await props.onContinue(draft.trim(), live)
        : await props.onStart(draft.trim(), live);
    if (ok) setDraft("");
  }

  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col bg-panel">
      <MissionPicker
        missions={props.missions}
        activeMissionId={props.sessionMissionId}
        onSelect={props.onSelectMission}
        onNewMission={props.onNewMission}
        onClearAll={props.onClearMissions}
      />

      <div className="flex shrink-0 border-b border-border px-3">
        <TabButton active={tab === "agent"} onClick={() => setTab("agent")}>
          Agent
        </TabButton>
        <TabButton active={tab === "files"} onClick={() => setTab("files")}>
          Files
        </TabButton>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "agent" ? (
          <ChatRail
            embedded
            state={props.state}
            running={props.running}
            onSelectDecision={props.onSelectDecision}
            onAnswer={props.onAnswer}
            onClarify={props.onClarify}
            onOpenHarness={props.onOpenHarness}
          />
        ) : (
          <WorktreeExplorer
            missionId={props.sessionMissionId}
            branches={props.branches}
            snapshot={props.worktree}
            loading={props.worktreeLoading}
            selectedPath={props.selectedFilePath}
            onSelectPath={props.onSelectFile}
            onRefresh={props.onRefreshWorktree}
            onSelectRoot={props.onSelectWorktreeRoot}
            activeRoot={props.worktreeRootKey}
          />
        )}
      </div>

      <Composer
        draft={draft}
        live={live}
        running={props.running}
        hasSession={Boolean(props.sessionMissionId)}
        error={props.runError}
        onDraftChange={setDraft}
        onLiveChange={setLive}
        onRun={() => void handleRun()}
      />
    </aside>
  );
}

function TabButton({
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
        "relative px-3 py-2.5 text-[12px] font-medium transition",
        active ? "text-ink" : "text-muted hover:text-ink"
      ].join(" ")}
    >
      {children}
      {active ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
    </button>
  );
}
