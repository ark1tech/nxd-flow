import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import type { Branch, WorktreeEntry, WorktreeSnapshot } from "@autopilot/shared";
import { EmptyState } from "./EmptyState";

interface WorktreeExplorerProps {
  missionId?: string;
  branches: Branch[];
  snapshot?: WorktreeSnapshot;
  loading: boolean;
  selectedPath?: string;
  onSelectPath: (path: string) => void;
  onRefresh: () => void;
  onSelectRoot: (branchId?: string) => void;
  activeRoot?: string;
}

export function WorktreeExplorer({
  missionId,
  branches,
  snapshot,
  loading,
  selectedPath,
  onSelectPath,
  onRefresh,
  onSelectRoot,
  activeRoot
}: WorktreeExplorerProps): ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ src: true });

  const roots = useMemo(() => {
    const items = [{ id: "main", label: "Main scratch", branchId: undefined as string | undefined }];
    for (const branch of branches) {
      items.push({ id: branch.id, label: `Branch · ${branch.newChoice}`, branchId: branch.id });
    }
    return items;
  }, [branches]);

  if (!missionId) {
    return <EmptyState title="No worktree" description="Select or start a mission to browse its scratch repo." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-muted">Worktree</p>
          <button type="button" onClick={() => void onRefresh()} className="text-[11px] text-accent hover:text-accent-hover">
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {roots.map((root) => (
            <button
              key={root.id}
              type="button"
              onClick={() => onSelectRoot(root.branchId)}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                (activeRoot ?? "main") === (root.branchId ?? "main")
                  ? "bg-accent text-white"
                  : "bg-canvas text-muted hover:text-ink"
              ].join(" ")}
            >
              {root.label}
            </button>
          ))}
        </div>
        {snapshot ? (
          <p className="truncate font-mono text-[10px] text-muted">{snapshot.displayPath}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2">
        {loading ? (
          <p className="px-3 py-2 text-[12px] text-muted">Loading tree…</p>
        ) : !snapshot?.entries.length ? (
          <p className="px-3 py-2 text-[12px] text-muted">Worktree not available yet.</p>
        ) : (
          <TreeList
            entries={snapshot.entries}
            depth={0}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={(path) => setExpanded((current) => ({ ...current, [path]: !current[path] }))}
            onSelect={onSelectPath}
          />
        )}
      </div>
    </div>
  );
}

function TreeList({
  entries,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect
}: {
  entries: WorktreeEntry[];
  depth: number;
  expanded: Record<string, boolean>;
  selectedPath?: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}): ReactElement {
  return (
    <ul>
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={depth}
          expanded={expanded}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function TreeNode({
  entry,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect
}: {
  entry: WorktreeEntry;
  depth: number;
  expanded: Record<string, boolean>;
  selectedPath?: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}): ReactElement {
  const isDir = entry.kind === "directory";
  const isOpen = expanded[entry.path] ?? depth < 1;
  const selected = selectedPath === entry.path;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (isDir) onToggle(entry.path);
          else onSelect(entry.path);
        }}
        className={[
          "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left transition",
          selected ? "bg-accent/10 text-accent" : "text-ink hover:bg-canvas"
        ].join(" ")}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="w-3 shrink-0 text-[10px] text-muted">{isDir ? (isOpen ? "▾" : "▸") : " "}</span>
        <FileIcon kind={entry.kind} name={entry.name} />
        <span className="min-w-0 flex-1 truncate text-[12px]">{entry.name}</span>
        {entry.status ? <StatusDot status={entry.status} /> : null}
      </button>
      {isDir && isOpen && entry.children?.length ? (
        <TreeList
          entries={entry.children}
          depth={depth + 1}
          expanded={expanded}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ) : null}
    </li>
  );
}

function FileIcon({ kind, name }: { kind: WorktreeEntry["kind"]; name: string }): ReactElement {
  const color = kind === "directory" ? "text-accent" : fileColor(name);
  return (
    <svg className={`h-3.5 w-3.5 shrink-0 ${color}`} viewBox="0 0 16 16" fill="currentColor">
      {kind === "directory" ? (
        <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3.086a1.5 1.5 0 0 1 1.06.44L8.5 3.5H12.5A1.5 1.5 0 0 1 14 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9Z" />
      ) : (
        <path d="M4 1.5A1.5 1.5 0 0 1 5.5 0h3.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914A1.5 1.5 0 0 1 13 4.414V12.5A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-11Z" />
      )}
    </svg>
  );
}

function StatusDot({ status }: { status: NonNullable<WorktreeEntry["status"]> }): ReactElement {
  const styles: Record<NonNullable<WorktreeEntry["status"]>, string> = {
    modified: "text-warning",
    added: "text-success",
    untracked: "text-accent",
    deleted: "text-danger"
  };
  return <span className={`shrink-0 text-[10px] font-semibold ${styles[status]}`}>{status === "untracked" ? "U" : status[0]?.toUpperCase()}</span>;
}

function fileColor(name: string): string {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "text-accent";
  if (name.endsWith(".json")) return "text-warning";
  if (name.endsWith(".md")) return "text-muted";
  return "text-muted";
}
