import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { DecisionNode, Edge, EngineEvent, Mission } from "@autopilot/shared";

type Db = Database.Database;

export class DecisionStore {
  readonly db: Db;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  migrate(): void {
    this.db.exec(`
      create table if not exists missions (
        id text primary key,
        idea text not null,
        status text not null,
        branch_name text,
        created_at text not null,
        updated_at text not null
      );
      create table if not exists decisions (
        id text primary key,
        mission_id text not null,
        question text not null,
        options_json text not null,
        choice text not null,
        rationale text not null,
        evidence_json text not null,
        surfaces_json text not null,
        depends_on_json text not null,
        tier text not null,
        rule_fired text not null,
        status text not null,
        reviewed integer not null default 0,
        commit_sha text,
        created_at text not null,
        updated_at text not null
      );
      create table if not exists edges (
        from_id text not null,
        to_id text not null,
        kind text not null,
        evidence text,
        primary key (from_id, to_id, kind)
      );
      create table if not exists events (
        id text primary key,
        type text not null,
        mission_id text,
        payload_json text not null,
        created_at text not null
      );
      create table if not exists cache (
        key text primary key,
        value_json text not null,
        updated_at text not null
      );
    `);
  }

  createMission(idea: string): Mission {
    const now = isoNow();
    const mission: Mission = {
      id: `mis_${nanoid(10)}`,
      idea,
      status: "created",
      createdAt: now,
      updatedAt: now
    };
    this.db
      .prepare(
        "insert into missions (id, idea, status, branch_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
      )
      .run(mission.id, mission.idea, mission.status, mission.branchName ?? null, mission.createdAt, mission.updatedAt);
    this.addEvent("mission.started", mission.id, mission);
    return mission;
  }

  updateMissionStatus(id: string, status: Mission["status"]): void {
    this.db.prepare("update missions set status = ?, updated_at = ? where id = ?").run(status, isoNow(), id);
  }

  getMission(id: string): Mission | undefined {
    const row = this.db.prepare("select * from missions where id = ?").get(id) as MissionRow | undefined;
    return row ? missionFromRow(row) : undefined;
  }

  listMissions(): Mission[] {
    return (this.db.prepare("select * from missions order by created_at").all() as MissionRow[]).map(missionFromRow);
  }

  addDecision(input: Omit<DecisionNode, "id" | "createdAt" | "updatedAt" | "reviewed"> & { id?: string }): DecisionNode {
    const now = isoNow();
    const node: DecisionNode = {
      ...input,
      id: input.id ?? `dec_${nanoid(10)}`,
      reviewed: false,
      createdAt: now,
      updatedAt: now
    };
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `insert into decisions
          (id, mission_id, question, options_json, choice, rationale, evidence_json, surfaces_json, depends_on_json,
           tier, rule_fired, status, reviewed, commit_sha, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          node.id,
          node.missionId,
          node.question,
          JSON.stringify(node.options),
          node.choice,
          node.rationale,
          JSON.stringify(node.citedEvidence),
          JSON.stringify(node.citedSurfaces),
          JSON.stringify(node.dependsOn),
          node.tier,
          node.ruleFired,
          node.status,
          node.reviewed ? 1 : 0,
          node.commitSha ?? null,
          node.createdAt,
          node.updatedAt
        );
      for (const dep of node.dependsOn) {
        this.addEdge({ from: dep, to: node.id, kind: "declared", evidence: "Pilot cited dependency" });
      }
    });
    tx();
    this.addEvent("decision.proposed", node.missionId, node);
    return node;
  }

  updateDecision(node: DecisionNode): void {
    this.db
      .prepare(
        `update decisions set question = ?, options_json = ?, choice = ?, rationale = ?, evidence_json = ?,
        surfaces_json = ?, depends_on_json = ?, tier = ?, rule_fired = ?, status = ?, reviewed = ?, commit_sha = ?,
        updated_at = ? where id = ?`
      )
      .run(
        node.question,
        JSON.stringify(node.options),
        node.choice,
        node.rationale,
        JSON.stringify(node.citedEvidence),
        JSON.stringify(node.citedSurfaces),
        JSON.stringify(node.dependsOn),
        node.tier,
        node.ruleFired,
        node.status,
        node.reviewed ? 1 : 0,
        node.commitSha ?? null,
        isoNow(),
        node.id
      );
  }

  getDecision(id: string): DecisionNode | undefined {
    const row = this.db.prepare("select * from decisions where id = ?").get(id) as DecisionRow | undefined;
    return row ? decisionFromRow(row) : undefined;
  }

  listDecisions(missionId?: string): DecisionNode[] {
    const stmt = missionId
      ? this.db.prepare("select * from decisions where mission_id = ? order by created_at")
      : this.db.prepare("select * from decisions order by created_at");
    const rows = (missionId ? stmt.all(missionId) : stmt.all()) as DecisionRow[];
    return rows.map(decisionFromRow);
  }

  markReviewed(id: string, reviewed = true): void {
    this.db.prepare("update decisions set reviewed = ?, updated_at = ? where id = ?").run(reviewed ? 1 : 0, isoNow(), id);
  }

  addEdge(edge: Edge): void {
    this.db
      .prepare("insert or ignore into edges (from_id, to_id, kind, evidence) values (?, ?, ?, ?)")
      .run(edge.from, edge.to, edge.kind, edge.evidence ?? null);
  }

  listEdges(): Edge[] {
    return (this.db.prepare("select * from edges").all() as EdgeRow[]).map((row) => ({
      from: row.from_id,
      to: row.to_id,
      kind: row.kind as Edge["kind"],
      evidence: row.evidence ?? undefined
    }));
  }

  transitiveDependents(id: string): string[] {
    const edges = this.listEdges();
    const byFrom = new Map<string, string[]>();
    for (const edge of edges) {
      const list = byFrom.get(edge.from) ?? [];
      list.push(edge.to);
      byFrom.set(edge.from, list);
    }
    const seen = new Set<string>();
    const stack = [...(byFrom.get(id) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(byFrom.get(current) ?? []));
    }
    return [...seen];
  }

  invalidationSet(id: string): string[] {
    return [id, ...this.transitiveDependents(id)];
  }

  reusedSet(id: string, missionId?: string): string[] {
    const invalid = new Set(this.invalidationSet(id));
    return this.listDecisions(missionId).map((node) => node.id).filter((nodeId) => !invalid.has(nodeId));
  }

  topoOrder(missionId?: string): string[] {
    const nodes = this.listDecisions(missionId).map((node) => node.id);
    const nodeSet = new Set(nodes);
    const edges = this.listEdges().filter((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to));
    const indegree = new Map(nodes.map((id) => [id, 0]));
    const byFrom = new Map<string, string[]>();
    for (const edge of edges) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
      const list = byFrom.get(edge.from) ?? [];
      list.push(edge.to);
      byFrom.set(edge.from, list);
    }
    const queue = nodes.filter((id) => (indegree.get(id) ?? 0) === 0);
    const out: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      out.push(current);
      for (const next of byFrom.get(current) ?? []) {
        indegree.set(next, (indegree.get(next) ?? 0) - 1);
        if (indegree.get(next) === 0) queue.push(next);
      }
    }
    if (out.length !== nodes.length) {
      throw new Error("Decision graph contains a cycle");
    }
    return out;
  }

  addEvent(type: EngineEvent["type"], missionId: string | undefined, payload: unknown): EngineEvent {
    const event: EngineEvent = {
      id: `evt_${nanoid(10)}`,
      type,
      missionId,
      payload,
      createdAt: isoNow()
    };
    this.db
      .prepare("insert into events (id, type, mission_id, payload_json, created_at) values (?, ?, ?, ?, ?)")
      .run(event.id, event.type, event.missionId ?? null, JSON.stringify(event.payload), event.createdAt);
    return event;
  }

  listEvents(afterId?: string): EngineEvent[] {
    if (!afterId) {
      return (this.db.prepare("select * from events order by created_at").all() as EventRow[]).map(eventFromRow);
    }
    const after = this.db.prepare("select created_at from events where id = ?").get(afterId) as { created_at: string } | undefined;
    if (!after) return this.listEvents();
    return (this.db.prepare("select * from events where created_at > ? order by created_at").all(after.created_at) as EventRow[]).map(
      eventFromRow
    );
  }

  cacheGet<T>(key: string): T | undefined {
    const row = this.db.prepare("select value_json from cache where key = ?").get(key) as { value_json: string } | undefined;
    return row ? (JSON.parse(row.value_json) as T) : undefined;
  }

  cacheSet(key: string, value: unknown): void {
    this.db
      .prepare("insert or replace into cache (key, value_json, updated_at) values (?, ?, ?)")
      .run(key, JSON.stringify(value), isoNow());
  }
}

interface MissionRow {
  id: string;
  idea: string;
  status: Mission["status"];
  branch_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DecisionRow {
  id: string;
  mission_id: string;
  question: string;
  options_json: string;
  choice: string;
  rationale: string;
  evidence_json: string;
  surfaces_json: string;
  depends_on_json: string;
  tier: DecisionNode["tier"];
  rule_fired: string;
  status: DecisionNode["status"];
  reviewed: 0 | 1;
  commit_sha: string | null;
  created_at: string;
  updated_at: string;
}

interface EdgeRow {
  from_id: string;
  to_id: string;
  kind: string;
  evidence: string | null;
}

interface EventRow {
  id: string;
  type: EngineEvent["type"];
  mission_id: string | null;
  payload_json: string;
  created_at: string;
}

function missionFromRow(row: MissionRow): Mission {
  return {
    id: row.id,
    idea: row.idea,
    status: row.status,
    branchName: row.branch_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function decisionFromRow(row: DecisionRow): DecisionNode {
  return {
    id: row.id,
    missionId: row.mission_id,
    question: row.question,
    options: JSON.parse(row.options_json),
    choice: row.choice,
    rationale: row.rationale,
    citedEvidence: JSON.parse(row.evidence_json),
    citedSurfaces: JSON.parse(row.surfaces_json),
    dependsOn: JSON.parse(row.depends_on_json),
    tier: row.tier,
    ruleFired: row.rule_fired,
    status: row.status,
    reviewed: row.reviewed === 1,
    commitSha: row.commit_sha ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function eventFromRow(row: EventRow): EngineEvent {
  return {
    id: row.id,
    type: row.type,
    missionId: row.mission_id ?? undefined,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at
  };
}

function isoNow(): string {
  return new Date().toISOString();
}
