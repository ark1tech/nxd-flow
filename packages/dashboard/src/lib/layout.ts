import dagre from "dagre";
import type { Edge, DecisionNode, PendingNode } from "@autopilot/shared";
import type { Edge as FlowEdge, Node as FlowNode } from "reactflow";
import { optionGraphId } from "./graphNodes";

export interface DagNodeData {
  label: string;
  tier: string;
  status: string;
  reviewed: boolean;
  pending?: boolean;
  changed?: boolean;
  dimmed?: boolean;
  needsInput?: boolean;
  selected?: boolean;
}

export interface OptionNodeData {
  label: string;
  recommended: boolean;
  selected?: boolean;
}

type AnyNodeData = DagNodeData | OptionNodeData;

export function layoutGraph(
  decisions: DecisionNode[],
  edges: Edge[],
  pendingNodes: PendingNode[],
  changedIds: Set<string>,
  dimmedIds: Set<string>,
  expandOptionsForDecisionId?: string
): { nodes: FlowNode<AnyNodeData>[]; edges: FlowEdge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 72 });

  const layoutEdges = [...edges];
  if (layoutEdges.length === 0 && decisions.length > 1) {
    for (let index = 1; index < decisions.length; index += 1) {
      const current = decisions[index];
      const from = current.dependsOn[0] ?? decisions[index - 1].id;
      layoutEdges.push({ from, to: current.id, kind: "declared" });
    }
  }

  const nodes: FlowNode<AnyNodeData>[] = decisions.map((decision) => {
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
    if (prior) layoutEdges.push({ from: prior.id, to: id, kind: "declared" });
  }

  const flowEdges: Array<{ from: string; to: string; kind: string }> = [...layoutEdges];

  if (expandOptionsForDecisionId) {
    const decision = decisions.find((item) => item.id === expandOptionsForDecisionId);
    if (decision) {
      for (const option of decision.options) {
        const optId = optionGraphId(decision.id, option.id);
        graph.setNode(optId, { width: 208, height: 68 });
        nodes.push({
          id: optId,
          type: "option",
          position: { x: 0, y: 0 },
          data: {
            label: option.label,
            recommended: option.id === decision.choice
          }
        });
        flowEdges.push({ from: decision.id, to: optId, kind: "option" });
        graph.setEdge(decision.id, optId);
      }
    }
  }

  for (const edge of layoutEdges) {
    if (graph.hasNode(edge.from) && graph.hasNode(edge.to)) graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);
  for (const node of nodes) {
    const position = graph.node(node.id);
    if (!position) continue;
    const width = node.type === "option" ? 104 : 110;
    const height = node.type === "option" ? 34 : 36;
    node.position = { x: position.x - width, y: position.y - height };
    node.draggable = false;
  }

  return {
    nodes,
    edges: flowEdges.map((edge) => ({
      id: `${edge.from}-${edge.to}-${edge.kind}`,
      source: edge.from,
      target: edge.to,
      label: edge.kind === "declared" || edge.kind === "derived" ? edge.kind : undefined,
      animated: edge.kind === "derived" || edge.kind === "declared",
      style: edgeStyle(edge.kind)
    }))
  };
}

function edgeStyle(kind: string): { stroke: string; strokeWidth: number; strokeDasharray?: string } {
  if (kind === "option") return { stroke: "rgb(0, 122, 255)", strokeWidth: 1.25, strokeDasharray: "4 3" };
  if (kind === "derived" || kind === "declared") return { stroke: "rgb(0, 122, 255)", strokeWidth: 1.5 };
  return { stroke: "rgb(199, 199, 204)", strokeWidth: 1.5 };
}
