import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Background, Controls, ReactFlow, type Edge as FlowEdge, type Node as FlowNode } from "reactflow";
import "reactflow/dist/style.css";
import type { DecisionNode, Edge, EngineEvent, Mission } from "@autopilot/shared";
import "./style.css";

interface State {
  missions: Mission[];
  decisions: DecisionNode[];
  edges: Edge[];
  events: EngineEvent[];
}

function App(): React.ReactElement {
  const [state, setState] = useState<State>({ missions: [], decisions: [], edges: [], events: [] });
  const [idea, setIdea] = useState("Add authentication");
  const [overrideChoice, setOverrideChoice] = useState("sessions");

  useEffect(() => {
    fetch("/api/state")
      .then((res) => res.json())
      .then(setState)
      .catch(() => undefined);
    const ws = new WebSocket(`ws://${window.location.hostname}:4317`);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as { payload: State };
      setState(message.payload);
    };
    return () => ws.close();
  }, []);

  const flow = useMemo(() => toFlow(state.decisions, state.edges), [state.decisions, state.edges]);
  const debt = state.decisions.filter((decision) => !decision.reviewed).reduce((sum, decision) => sum + tierWeight(decision.tier), 0);
  const waitingDecision = useMemo(() => {
    const waitingMissionIds = new Set(state.missions.filter((mission) => mission.status === "waiting").map((mission) => mission.id));
    return [...state.decisions].reverse().find((decision) => waitingMissionIds.has(decision.missionId) && decision.status === "proposed");
  }, [state.decisions, state.missions]);
  const pivotEvent = [...state.events].reverse().find((event) => event.type === "pivot.completed");

  async function startMission(): Promise<void> {
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idea })
    });
    const next = await res.json();
    setState((current) => ({ ...current, decisions: next.decisions ?? current.decisions }));
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Autopilot MVP</p>
          <h1>Decision-first build loop</h1>
        </div>
        <div className="mission-form">
          <input value={idea} onChange={(event) => setIdea(event.target.value)} />
          <button onClick={startMission}>Start Mission</button>
        </div>
      </header>

      <section className="stats">
        <article>
          <span>Missions</span>
          <strong>{state.missions.length}</strong>
        </article>
        <article>
          <span>Decision Nodes</span>
          <strong>{state.decisions.length}</strong>
        </article>
        <article>
          <span>Comprehension Debt</span>
          <strong>{debt}</strong>
        </article>
      </section>

      {waitingDecision ? (
        <section className="panel escalation">
          <p className="eyebrow">Human checkpoint</p>
          <h2>{waitingDecision.question}</h2>
          <p>{waitingDecision.rationale}</p>
          <div className="evidence">
            <span>Tier: {waitingDecision.tier}</span>
            <span>Rule: {waitingDecision.ruleFired}</span>
            <span>Coverage: uncovered</span>
          </div>
          <div className="mission-form">
            <button onClick={() => answer(waitingDecision.id, "approve")}>Approve JWT</button>
            <input value={overrideChoice} onChange={(event) => setOverrideChoice(event.target.value)} />
            <button onClick={() => answer(waitingDecision.id, "override", overrideChoice)}>Override</button>
          </div>
        </section>
      ) : null}

      <section className="grid">
        <div className="panel">
          <h2>Onboarding Feed</h2>
          {state.decisions.map((decision) => (
            <article className="decision" key={decision.id}>
              <div className={`tier ${decision.tier}`}>{decision.tier}</div>
              <h3>{decision.question}</h3>
              <p>{decision.rationale}</p>
              <small>
                choice {decision.choice} · rule {decision.ruleFired}
              </small>
              <div className="actions">
                <button onClick={() => review(decision.id)}>Mark reviewed</button>
                <button onClick={() => saveLesson(decision.id)}>Save lesson</button>
                <button onClick={() => pivot(decision.id)}>Pivot</button>
              </div>
            </article>
          ))}
        </div>
        <div className="panel graph">
          <h2>Decision DAG</h2>
          <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </section>
      {pivotEvent ? (
        <section className="panel">
          <h2>Pivot Compare</h2>
          <pre>{JSON.stringify(pivotEvent.payload, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );

  async function review(id: string): Promise<void> {
    await fetch(`/api/decisions/${id}/review`, { method: "POST" });
  }

  async function saveLesson(id: string): Promise<void> {
    await fetch(`/api/decisions/${id}/lesson`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
  }

  async function pivot(id: string): Promise<void> {
    await fetch(`/api/decisions/${id}/pivot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choice: "alternate" })
    });
  }

  async function answer(id: string, mode: "approve" | "override", choice?: string): Promise<void> {
    await fetch(`/api/decisions/${id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, choice })
    });
  }
}

function toFlow(decisions: DecisionNode[], edges: Edge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: decisions.map((decision, index) => ({
      id: decision.id,
      position: { x: (index % 3) * 260, y: Math.floor(index / 3) * 160 },
      data: { label: `${decision.tier}: ${decision.question}` },
      className: `node-${decision.tier}`
    })),
    edges: edges.map((edge) => ({
      id: `${edge.from}-${edge.to}-${edge.kind}`,
      source: edge.from,
      target: edge.to,
      label: edge.kind
    }))
  };
}

function tierWeight(tier: DecisionNode["tier"]): number {
  return { low: 1, medium: 3, high: 8, critical: 13 }[tier];
}

createRoot(document.getElementById("root")!).render(<App />);
