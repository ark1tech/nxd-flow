import dagre from "dagre";
import type { ClarificationQuestion } from "@autopilot/shared";
import type { Edge as FlowEdge, Node as FlowNode } from "reactflow";
import { SCOPE_NODE_ID, scopeOptionGraphId } from "./graphNodes";
import type { OptionNodeData } from "./layout";

export interface ScopeNodeData {
  label: string;
  needsInput?: boolean;
  selected?: boolean;
}

export function layoutScopeGraph(question: ClarificationQuestion): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 72 });

  const nodes: FlowNode[] = [
    {
      id: SCOPE_NODE_ID,
      type: "scope",
      position: { x: 0, y: 0 },
      data: {
        label: question.title,
        needsInput: true
      }
    }
  ];

  graph.setNode(SCOPE_NODE_ID, { width: 220, height: 72 });

  const edges: FlowEdge[] = [];

  for (const option of question.options) {
    const optId = scopeOptionGraphId(option.id);
    graph.setNode(optId, { width: 208, height: 68 });
    nodes.push({
      id: optId,
      type: "option",
      position: { x: 0, y: 0 },
      data: {
        label: option.label,
        recommended: option.id === question.recommendation
      } satisfies OptionNodeData
    });
    edges.push({
      id: `${SCOPE_NODE_ID}-${optId}`,
      source: SCOPE_NODE_ID,
      target: optId,
      type: "smoothstep"
    });
    graph.setEdge(SCOPE_NODE_ID, optId);
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

  return { nodes, edges };
}
