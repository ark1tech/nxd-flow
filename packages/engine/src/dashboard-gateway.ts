import http from "node:http";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import type { DecisionStore } from "./decision-store.js";
import type { LoopEngine } from "./loop-engine.js";

export class DashboardGateway {
  private readonly app = express();
  private server?: http.Server;
  private wss?: WebSocketServer;

  constructor(
    private readonly store: DecisionStore,
    private readonly engine: LoopEngine
  ) {
    this.engine.setEventHandler(() => this.broadcast());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.get("/api/state", (_req, res) => {
      res.json({ missions: this.store.listMissions(), decisions: this.store.listDecisions(), edges: this.store.listEdges(), events: this.store.listEvents() });
    });
    this.app.post("/api/missions", async (req, res, next) => {
      try {
        const result = await this.engine.startMission(String(req.body.idea ?? "Build a feature"), { live: Boolean(req.body.live) });
        this.broadcast();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/decisions/:id/review", (req, res) => {
      this.store.markReviewed(req.params.id, true);
      this.store.addEvent("debt.updated", undefined, { decisionId: req.params.id });
      this.broadcast();
      res.json({ ok: true });
    });
    this.app.post("/api/decisions/:id/lesson", (req, res, next) => {
      try {
        const path = this.engine.saveLesson(req.params.id, req.body?.body);
        this.broadcast();
        res.json({ ok: true, path });
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/decisions/:id/answer", async (req, res, next) => {
      try {
        const result = await this.engine.answerEscalation(req.params.id, {
          mode: req.body?.mode === "override" ? "override" : "approve",
          choice: req.body?.choice
        });
        this.broadcast();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/decisions/:id/pivot", async (req, res, next) => {
      try {
        const result = await this.engine.pivot(req.params.id, String(req.body.choice ?? "override"));
        this.broadcast();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
  }

  listen(port = 4317): http.Server {
    this.server = this.app.listen(port);
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "state", payload: this.snapshot() }));
    });
    return this.server;
  }

  close(): void {
    this.wss?.close();
    this.server?.close();
  }

  broadcast(): void {
    const payload = JSON.stringify({ type: "state", payload: this.snapshot() });
    for (const client of this.wss?.clients ?? []) {
      client.send(payload);
    }
  }

  private snapshot(): unknown {
    return {
      missions: this.store.listMissions(),
      decisions: this.store.listDecisions(),
      edges: this.store.listEdges(),
      events: this.store.listEvents()
    };
  }
}
