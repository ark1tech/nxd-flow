import http from "node:http";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import type { DashboardMessage, DashboardSnapshot, EngineEvent } from "@autopilot/shared";
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
    this.engine.setEventHandler((event, extras) => this.onEngineEvent(event, extras));
    this.app.use(cors());
    this.app.use(express.json());
    this.app.get("/api/state", (_req, res) => {
      res.json(this.snapshot());
    });
    this.app.get("/api/missions", (_req, res) => {
      res.json({ missions: this.engine.listMissionSummaries() });
    });
    this.app.get("/api/missions/:id/worktree", (req, res, next) => {
      try {
        const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
        res.json(this.engine.getWorktreeSnapshot(req.params.id, branchId));
      } catch (error) {
        next(error);
      }
    });
    this.app.get("/api/missions/:id/worktree/file", (req, res, next) => {
      try {
        const path = String(req.query.path ?? "");
        const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
        res.json(this.engine.readWorktreeFile(req.params.id, path, branchId));
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/onboarding/questions", (req, res) => {
      res.json(this.engine.generateOnboardingQuestions(String(req.body?.idea ?? "Build a feature")));
    });
    this.app.post("/api/onboarding/answers", (req, res) => {
      const answers = Array.isArray(req.body?.answers) ? req.body.answers.map(String) : [];
      const result = this.engine.submitOnboardingAnswers(answers);
      this.broadcastState();
      res.json(result);
    });
    this.app.post("/api/missions", async (req, res, next) => {
      try {
        const result = await this.engine.startMission(String(req.body.idea ?? "Build a feature"), {
          live: Boolean(req.body.live),
          background: req.body.background !== false
        });
        this.broadcastState();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/missions/clear", (_req, res) => {
      this.engine.clearAllMissions();
      this.broadcastState();
      res.json({ ok: true });
    });
    this.app.post("/api/missions/:id/clarify", async (req, res, next) => {
      try {
        const answer = String(req.body?.answer ?? "").trim();
        if (!answer) throw new Error("Answer is required");
        if (req.body?.background !== false) {
          void this.engine
            .answerClarification(req.params.id, answer, { background: true })
            .then(() => this.broadcastState())
            .catch((error) => next(error));
          res.json({ ok: true });
          return;
        }
        const result = await this.engine.answerClarification(req.params.id, answer);
        this.broadcastState();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    this.app.get("/api/missions/:id/harness", (req, res) => {
      res.json({ records: this.engine.getHarnessRecords(req.params.id) });
    });
    this.app.get("/api/missions/:id/filegraph", (req, res, next) => {
      try {
        const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
        res.json(this.engine.getFileGraph(req.params.id, branchId));
      } catch (error) {
        next(error);
      }
    });
    this.app.get("/api/skills", (_req, res) => {
      res.json(this.engine.getSkills());
    });
    this.app.put("/api/skills/:role", (req, res, next) => {
      try {
        const role = req.params.role as "planner" | "maker" | "auditor" | "scoper";
        if (!["planner", "maker", "auditor", "scoper"].includes(role)) throw new Error(`Unknown role: ${role}`);
        const skills = this.engine.updateSkill(role, String(req.body?.body ?? ""));
        res.json(skills);
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/decisions/:id/review", (req, res) => {
      this.store.markReviewed(req.params.id, true);
      this.store.addEvent("debt.updated", undefined, { decisionId: req.params.id });
      this.broadcastState();
      res.json({ ok: true });
    });
    this.app.post("/api/decisions/:id/lesson", (req, res, next) => {
      try {
        const path = this.engine.saveLesson(req.params.id, req.body?.body);
        this.broadcastState();
        res.json({ ok: true, path });
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/decisions/:id/answer", async (req, res, next) => {
      try {
        const answer = {
          mode: req.body?.mode === "override" ? ("override" as const) : ("approve" as const),
          choice: req.body?.choice,
          scope: req.body?.scope
        };
        if (req.body?.background !== false) {
          void this.engine
            .answerEscalation(req.params.id, answer)
            .then(() => this.broadcastState())
            .catch((error) => next(error));
          res.json({ ok: true });
          return;
        }
        const result = await this.engine.answerEscalation(req.params.id, answer);
        this.broadcastState();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/decisions/:id/pivot", async (req, res, next) => {
      try {
        const choice = String(req.body.choice ?? "override");
        if (req.body?.background !== false) {
          void this.engine
            .pivot(req.params.id, choice)
            .then((result) => {
              this.broadcastState();
              return result;
            })
            .catch((error) => next(error));
          res.json({ ok: true });
          return;
        }
        const result = await this.engine.pivot(req.params.id, choice);
        this.broadcastState();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    this.app.post("/api/reset", (_req, res) => {
      this.engine.resetRuntimeState();
      this.broadcastState();
      res.json({ ok: true });
    });
  }

  listen(port = 4317): http.Server {
    this.server = this.app.listen(port);
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "state", payload: this.snapshot() } satisfies DashboardMessage));
    });
    return this.server;
  }

  close(): void {
    this.wss?.close();
    this.server?.close();
  }

  private onEngineEvent(
    event: EngineEvent,
    extras?: { activity?: DashboardSnapshot["activities"][number]; pending?: DashboardSnapshot["pendingNodes"][number]; clearPending?: string }
  ): void {
    this.send({ type: "event", payload: event });
    if (extras?.activity) this.send({ type: "activity", payload: extras.activity });
    if (extras?.pending) this.send({ type: "pending", payload: extras.pending });
    if (extras?.clearPending) this.send({ type: "pending.clear", payload: { id: extras.clearPending } });
    this.broadcastState();
  }

  broadcastState(): void {
    this.send({ type: "state", payload: this.snapshot() });
  }

  private send(message: DashboardMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.wss?.clients ?? []) {
      client.send(payload);
    }
  }

  private snapshot(): DashboardSnapshot {
    const missions = this.store.listMissions();
    const latestMission = missions.at(-1);
    const plan = latestMission ? this.engine.getPlan(latestMission.id) : undefined;
    const waitingMission = missions.find((mission) => mission.status === "waiting");
    const clarification = waitingMission ? this.engine.getClarification(waitingMission.id) : undefined;
    const harnessRecords = missions.flatMap((mission) => this.engine.getHarnessRecords(mission.id));
    return {
      missions,
      decisions: this.store.listMainDecisions(),
      edges: this.store.listEdges(),
      events: this.store.listEvents(),
      branches: this.engine.listBranches(),
      pendingNodes: this.engine.getPendingNodes(),
      activities: this.engine.getActivities(),
      harnessRecords,
      clarification,
      plan,
      trainingWheels: this.engine.generateOnboardingQuestions("").trainingWheels,
      profileRules: this.engine.profileRules(),
      knowledgeFacts: this.engine.knowledgeFacts()
    };
  }
}
