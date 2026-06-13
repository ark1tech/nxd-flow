import type { ReactElement } from "react";
import { memo, useEffect, useMemo } from "react";
import ReactFlow, { Background, Controls, Handle, Position, ReactFlowProvider, type NodeMouseHandler, type NodeProps, useReactFlow } from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import type { FileGraphSnapshot } from "@autopilot/shared";
import { EmptyState } from "./EmptyState";

interface FileGraphCanvasProps {
  graph?: FileGraphSnapshot;
  loading?: boolean;
  onSelectFile: (path: string) => void;
  compact?: boolean;
}

interface FileNodeData {
  label: string;
  folder: string;
  status: string;
}

const fileNodeTypes = { fileNode: memo(FileNodeCard) };

export function FileGraphCanvas({ graph, loading, onSelectFile, compact }: FileGraphCanvasProps): ReactElement {
  const flow = useMemo(() => (graph ? layoutFileGraph(graph) : { nodes: [], edges: [] }), [graph]);
  const empty = !loading && (!graph || graph.files.length === 0);
  const disconnected = !empty && graph && graph.imports.length === 0;

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    onSelectFile(node.id);
  };

  return (
    <div className={`flex min-h-0 ${compact ? "flex-[1.2]" : "flex-1"} flex-col p-2`}>
      <section className="relative flex h-full min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-card">
        <div className="absolute left-3 top-3 z-10 rounded-md bg-panel/90 px-2 py-0.5 text-[10px] font-medium text-muted backdrop-blur">
          File dependency graph
        </div>
        {loading ? (
          <EmptyState title="Loading file graph…" description="Parsing imports from the scratch worktree." />
        ) : empty ? (
          <EmptyState title="No files yet" description="Files will appear here as the agent edits the scratch repo." />
        ) : (
          <div className="absolute inset-0">
            <ReactFlowProvider>
              <FileFlowCanvas flow={flow} onNodeClick={onNodeClick} />
            </ReactFlowProvider>
            {disconnected ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
                <p className="rounded-md bg-panel/90 px-2.5 py-1 text-[10px] font-medium text-muted backdrop-blur">
                  No internal dependencies yet
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}


function FileFlowCanvas({
  flow,
  onNodeClick
}: {
  flow: ReturnType<typeof layoutFileGraph>;
  onNodeClick: NodeMouseHandler;
}): ReactElement {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (flow.nodes.length === 0) return;
    const timer = window.setTimeout(() => void fitView({ padding: 0.2, duration: 250 }), 50);
    return () => window.clearTimeout(timer);
  }, [flow.nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      nodeTypes={fileNodeTypes}
      onNodeClick={onNodeClick}
      fitView
      proOptions={{ hideAttribution: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <Background color="#e5e5ea" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function FileNodeCard({ data }: NodeProps<FileNodeData>): ReactElement {
  const changed = data.status !== "unchanged";
  return (
    <div
      className={[
        "w-44 rounded-xl border px-2.5 py-2 shadow-card transition",
        changed ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-panel opacity-80"
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
      <div className="flex items-center gap-1.5">
        {changed ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
        <p className="truncate text-[11px] font-medium text-ink">{data.label}</p>
      </div>
      <p className="mt-0.5 truncate text-[9px] text-muted">{data.folder}</p>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-none !bg-border-strong" />
    </div>
  );
}

function layoutFileGraph(graph: FileGraphSnapshot) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 64 });

  const folderOf = (path: string): string => {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
  };

  const folders = [...new Set(graph.files.map((file) => folderOf(file.path)))].sort();
  const folderOffset = new Map<string, number>();
  folders.forEach((folder, index) => folderOffset.set(folder, index * 120));

  const nodes = graph.files.map((file) => {
    const folder = folderOf(file.path);
    g.setNode(file.path, { width: 176, height: 52 });
    return {
      id: file.path,
      type: "fileNode" as const,
      position: { x: 0, y: 0 },
      data: {
        label: file.path.split("/").pop() ?? file.path,
        folder,
        status: file.status
      } satisfies FileNodeData
    };
  });

  for (const edge of graph.imports) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (!pos) continue;
    const lane = folderOffset.get(node.data.folder) ?? 0;
    node.position = { x: pos.x - 88, y: pos.y - 26 + lane * 0.15 };
  }

  return {
    nodes,
    edges: graph.imports.map((edge) => ({
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      animated: true,
      style: { stroke: "rgb(0, 122, 255)", strokeWidth: 1.2 }
    }))
  };
}
