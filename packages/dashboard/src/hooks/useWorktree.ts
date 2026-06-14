import { useCallback, useEffect, useState } from "react";
import type { WorktreeSnapshot } from "@autopilot/shared";

export function useWorktree(missionId?: string, branchId?: string, refreshKey: string | number = 0): {
  snapshot?: WorktreeSnapshot;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [snapshot, setSnapshot] = useState<WorktreeSnapshot>();
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!missionId) {
      setSnapshot(undefined);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      const query = params.toString();
      const res = await fetch(`/api/missions/${missionId}/worktree${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error("Worktree unavailable");
      setSnapshot((await res.json()) as WorktreeSnapshot);
    } catch {
      setSnapshot(undefined);
    } finally {
      setLoading(false);
    }
  }, [missionId, branchId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { snapshot, loading, refresh };
}

export async function fetchWorktreeFile(
  missionId: string,
  path: string,
  branchId?: string
): Promise<{ path: string; content: string; language: string }> {
  const params = new URLSearchParams({ path });
  if (branchId) params.set("branchId", branchId);
  const res = await fetch(`/api/missions/${missionId}/worktree/file?${params.toString()}`);
  if (!res.ok) throw new Error("File unavailable");
  return (await res.json()) as { path: string; content: string; language: string };
}
