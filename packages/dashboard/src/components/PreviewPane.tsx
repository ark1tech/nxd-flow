import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { PreviewInfo } from "@autopilot/shared";
import { EmptyState } from "./EmptyState";

interface PreviewPaneProps {
  missionId?: string;
  branchId?: string;
  refreshKey: string | number;
  compact?: boolean;
}

export function PreviewPane({ missionId, branchId, refreshKey, compact }: PreviewPaneProps): ReactElement {
  const [preview, setPreview] = useState<PreviewInfo>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!missionId) {
      setPreview(undefined);
      return;
    }
    setLoading(true);
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    void fetch(`/api/missions/${missionId}/preview${query}`)
      .then((res) => res.json())
      .then((payload: PreviewInfo) => setPreview(payload))
      .catch(() => setPreview({ missionId, ready: false, reason: "Preview unavailable" }))
      .finally(() => setLoading(false));
  }, [missionId, branchId, refreshKey]);

  return (
    <div className={`flex min-h-0 ${compact ? "flex-[1.2]" : "flex-1"} flex-col p-2`}>
      <section className="relative flex h-full min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-card">
        <div className="absolute left-3 top-3 z-10 rounded-md bg-panel/90 px-2 py-0.5 text-[10px] font-medium text-muted backdrop-blur">
          Live preview
        </div>
        {loading ? (
          <EmptyState title="Loading preview…" description="Checking the scratch worktree for a site entry point." />
        ) : !missionId ? (
          <EmptyState title="No mission yet" description="Start a mission to preview the site as the agent builds it." />
        ) : preview?.ready && preview.url ? (
          <iframe
            key={`${preview.url}-${refreshKey}`}
            title="Site preview"
            src={preview.url}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <EmptyState
            title="Preview not ready"
            description={preview?.reason ?? "The agent has not written an index.html yet."}
          />
        )}
      </section>
    </div>
  );
}
