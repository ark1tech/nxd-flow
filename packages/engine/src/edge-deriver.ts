import type { Edge } from "@autopilot/shared";

export interface DecisionArtifact {
  decisionId: string;
  files: string[];
}

export function deriveFileOverlapEdges(artifacts: DecisionArtifact[]): Edge[] {
  const edges: Edge[] = [];
  for (const from of artifacts) {
    for (const to of artifacts) {
      if (from.decisionId === to.decisionId) continue;
      const overlap = to.files.find((file) => from.files.includes(file));
      if (overlap) {
        edges.push({ from: from.decisionId, to: to.decisionId, kind: "derived", evidence: `file-overlap:${overlap}` });
      }
    }
  }
  return edges;
}
