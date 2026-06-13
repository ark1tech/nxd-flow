import dagre from "dagre";
import type { Edge, DecisionNode, PendingNode } from "@autopilot/shared";
import type { Edge as FlowEdge, Node as FlowNode } from "reactflow";

export interface DagNodeData {
  label: string;
  tier: string;
  status: string;
  reviewed: boolean;
  pending?: boolean;
  changed?: boolean;
  dimmed?: boolean;
}

export function layoutGraph(
  decisions: DecisionNode[],
  edges: Edge[],
  pendingNodes: PendingNode[],
  changedIds: Set<string>,
  dimmedIds: Set<string>
): { nodes: FlowNode<DagNodeData>[]; edges: FlowEdge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90 });

  const nodes: FlowNode<DagNodeData>[] = decisions.map((decision) => {
    const id = decision.id;
    graph.setNode(id, { width: 220, height: 72 });
    return {
      id,
      type: "decision",
      position: { x: 0, y: 0 },
      data: {
        label: decision.question,
        tier: decision.tier,
        status: decision.status,
        reviewed: decision.reviewed,
        changed: changedIds.has(id),
        dimmed: dimmedIds.has(id)
      }
    };
  });

  for (const pending of pendingNodes) {
    const id = pending.id;
    graph.setNode(id, { width: 220, height: 72 });
    nodes.push({
      id,
      type: "decision",
      position: { x: 0, y: 0 },
      data: {
        label: pending.label,
        tier: "medium",
        status: "pending",
        reviewed: false,
        pending: true
      }
    });
    const prior = decisions.at(-1);
    if (prior) edges = [...edges, { from: prior.id, to: id, kind: "declared" }];
  }

  for (const edge of edges) {
    if (graph.hasNode(edge.from) && graph.hasNode(edge.to)) graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);
  for (const node of nodes) {
    const position = graph.node(node.id);
    if (!position) continue;
    node.position = { x: position.x - 110, y: position.y - 36 };
    node.draggable = false;
  }

  return {
    nodes,
    edges: edges.map((edge) => ({
      id: `${edge.from}-${edge.to}-${edge.kind}`,
      source: edge.from,
      target: edge.to,
      label: edge.kind,
      animated: edge.kind === "derived",
      style: { stroke: edge.kind === "derived" ? "#007aff" : "#c7c7cc", strokeWidth: 1.5 }
    }))
  };
}
