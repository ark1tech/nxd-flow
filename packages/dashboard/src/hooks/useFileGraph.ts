import { useEffect, useState } from "react";
import type { FileGraphSnapshot } from "@autopilot/shared";

export function useFileGraph(missionId?: string, branchId?: string, refreshKey: string | number = 0) {
  const [graph, setGraph] = useState<FileGraphSnapshot>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!missionId) {
      setGraph(undefined);
      return;
    }
    setLoading(true);
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    void fetch(`/api/missions/${missionId}/filegraph${query}`)
      .then((res) => res.json())
      .then((payload: FileGraphSnapshot) => setGraph(payload))
      .catch(() => setGraph(undefined))
      .finally(() => setLoading(false));
  }, [missionId, branchId, refreshKey]);

  return { graph, loading };
}
