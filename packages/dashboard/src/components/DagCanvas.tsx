import type { ReactElement } from "react";
import { useEffect, useMemo } from "react";
import ReactFlow, { Background, Controls, ReactFlowProvider, type Node, type NodeMouseHandler, useReactFlow } from "reactflow";
import "reactflow/dist/style.css";
import type { Branch, DashboardSnapshot } from "@autopilot/shared";
import DecisionNodeCard from "./DecisionNodeCard";
import { EmptyState } from "./EmptyState";
import { layoutGraph } from "../lib/layout";

const nodeTypes = { decision: DecisionNodeCard };

interface DagCanvasProps {
  state: DashboardSnapshot;
  compareBranch?: Branch;
  onSelectDecision: (id: string) => void;
  selectedDecisionId?: string;
  compact?: boolean;
}

export function DagCanvas({ state, compareBranch, onSelectDecision, compact }: DagCanvasProps): ReactElement {
  const changedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!compareBranch) return ids;
    for (const node of compareBranch.decisions) ids.add(node.id);
    ids.add(compareBranch.fromDecisionId);
    return ids;
  }, [compareBranch]);

  const dimmedIds = useMemo(() => {
    if (!compareBranch) return new Set<string>();
    const invalidated = new Set(compareBranch.invalidated);
    return new Set(state.decisions.map((node) => node.id).filter((id) => !invalidated.has(id) && id !== compareBranch.fromDecisionId));
  }, [compareBranch, state.decisions]);

  const flow = useMemo(
    () => layoutGraph(state.decisions, state.edges, state.pendingNodes, changedIds, dimmedIds),
    [state.decisions, state.edges, state.pendingNodes, changedIds, dimmedIds]
  );

  const onNodeClick: NodeMouseHandler = (_event, node: Node) => {
    if (!node.id.startsWith("pending_")) onSelectDecision(node.id);
  };

  const empty = state.decisions.length === 0 && state.pendingNodes.length === 0;

  if (compareBranch) {
    return (
      <div className={`grid min-h-0 ${compact ? "flex-[1.2]" : "flex-1"} grid-cols-2 gap-2 p-2`}>
        <CanvasPane title="Original" flow={flow} onNodeClick={onNodeClick} empty={empty} />
        <BranchPane branch={compareBranch} onSelectDecision={onSelectDecision} />
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 ${compact ? "flex-[1.2]" : "flex-1"} flex-col p-2`}>
      <CanvasPane title="Decision graph" flow={flow} onNodeClick={onNodeClick} empty={empty} />
    </div>
  );
}

function CanvasPane({
  title,
  flow,
  onNodeClick,
  empty
}: {
  title: string;
  flow: ReturnType<typeof layoutGraph>;
  onNodeClick: NodeMouseHandler;
  empty: boolean;
}): ReactElement {
  return (
    <section className="relative flex h-full min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-panel">
      {!empty ? (
        <div className="absolute left-3 top-3 z-10 rounded-md bg-panel/90 px-2 py-0.5 text-[10px] font-medium text-muted backdrop-blur">
          {title}
        </div>
      ) : null}
      {empty ? (
        <EmptyState
          title="Decision graph"
          description="Your mission's decisions will appear here as Autopilot runs."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          }
        />
      ) : (
        <div className="absolute inset-0">
          <ReactFlowProvider>
            <FlowCanvas flow={flow} onNodeClick={onNodeClick} />
          </ReactFlowProvider>
        </div>
      )}
    </section>
  );
}

function FlowCanvas({
  flow,
  onNodeClick
}: {
  flow: ReturnType<typeof layoutGraph>;
  onNodeClick: NodeMouseHandler;
}): ReactElement {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (flow.nodes.length === 0) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.25, duration: 250 });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [flow.nodes.length, flow.edges.length, fitView]);

  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <Background color="#e5e5ea" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function BranchPane({ branch, onSelectDecision }: { branch: Branch; onSelectDecision: (id: string) => void }): ReactElement {
  const edges = branch.decisions.flatMap((node, index) =>
    index > 0 ? [{ from: branch.decisions[index - 1].id, to: node.id, kind: "declared" as const }] : []
  );
  const flow = layoutGraph(branch.decisions, edges, [], new Set(branch.decisions.map((node) => node.id)), new Set());

  return (
    <section className="relative flex h-full min-h-[320px] min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent/20 bg-panel">
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent backdrop-blur">
        Branch · {branch.newChoice}
      </div>
      <div className="absolute inset-0">
        <ReactFlowProvider>
          <FlowCanvas
            flow={flow}
            onNodeClick={((_event, node: Node) => onSelectDecision(node.id)) as NodeMouseHandler}
          />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
