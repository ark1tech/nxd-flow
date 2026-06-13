import { describe, expect, it } from "vitest";
import { AgentRunner, type CursorAgentAdapter } from "./agent-runner.js";

function runResult(text: string) {
  return {
    async wait() {
      return { status: "finished", result: text };
    }
  };
}

describe("AgentRunner", () => {
  it("uses mock replay mode without calling the SDK", async () => {
    const adapter: CursorAgentAdapter = {
      create: async () => {
        throw new Error("SDK should not be called in mock mode");
      }
    };
    const runner = new AgentRunner({ mode: "mock", adapter });

    const result = await runner.run({
      prompt: "Add auth",
      cwd: "/tmp/demo",
      role: "maker",
      missionId: "mis_1",
      stepName: "auth-strategy"
    });

    expect(result.status).toBe("finished");
    expect(result.proposedDecision?.question).toContain("JWT or sessions");
  });

  it("passes an inline autopilot MCP server to live SDK agents", async () => {
    const seen: unknown[] = [];
    const adapter: CursorAgentAdapter = {
      create: async (options) => {
        seen.push(options);
        return {
          send: async () =>
            runResult(
              '```json\n{"question":"Where should auth live?","options":[{"id":"routes","label":"Routes","pros":["Simple"],"cons":["Coupled"]},{"id":"framework","label":"Framework","pros":["Clean"],"cons":["Heavy"]}],"choice":"routes","rationale":"Fits fixture","citedEvidence":[],"citedSurfaces":[],"dependsOn":[]}\n```'
            ),
          dispose: async () => undefined
        };
      }
    };
    const runner = new AgentRunner({
      mode: "live",
      cursorApiKey: "crsr_test",
      makerModel: "maker-model",
      auditorModel: "auditor-model",
      mcp: { command: "node", args: ["dist/index.js"], env: { AUTOPILOT_ROOT: "/repo" } },
      adapter
    });

    const result = await runner.run({
      prompt: "Add auth",
      cwd: "/repo/.autopilot/worktrees/scratch/mis_1",
      role: "maker",
      missionId: "mis_1",
      stepName: "project-layout",
      live: true
    });

    expect(result.proposedDecision?.choice).toBe("routes");
    expect(seen[0]).toMatchObject({
      apiKey: "crsr_test",
      model: { id: "maker-model" },
      local: { cwd: "/repo/.autopilot/worktrees/scratch/mis_1" },
      mcpServers: {
        autopilot: {
          command: "node",
          args: ["dist/index.js"],
          env: { AUTOPILOT_ROOT: "/repo" }
        }
      }
    });
  });

  it("uses the live resume adapter when a resume id is present", async () => {
    const seen: unknown[] = [];
    const adapter: CursorAgentAdapter = {
      create: async () => {
        throw new Error("create should not be called for resume");
      },
      resume: async (resumeId, options) => {
        seen.push({ resumeId, options });
        return {
          send: async () =>
            runResult('```json\n{"question":"Persistence?","options":[{"id":"memory","label":"Memory","pros":["Fast"],"cons":["Volatile"]},{"id":"database","label":"Database","pros":["Durable"],"cons":["Setup"]}],"choice":"memory","rationale":"Fixture","citedEvidence":[],"citedSurfaces":[],"dependsOn":[]}\n```'),
          dispose: async () => undefined
        };
      }
    };
    const runner = new AgentRunner({
      mode: "live",
      cursorApiKey: "crsr_test",
      makerModel: "maker-model",
      mcp: { command: "node", args: ["mcp.js"] },
      adapter
    });

    const result = await runner.run({
      prompt: "Continue",
      cwd: "/repo/scratch",
      role: "maker",
      missionId: "mis_1",
      stepName: "auth-persistence",
      live: true,
      resumeId: "agent_123"
    });

    expect(result.proposedDecision?.choice).toBe("memory");
    expect(seen[0]).toMatchObject({
      resumeId: "agent_123",
      options: {
        mcpServers: { autopilot: { command: "node", args: ["mcp.js"] } },
        local: { cwd: "/repo/scratch" }
      }
    });
  });

  it("returns planned steps from mock planner", async () => {
    const runner = new AgentRunner({ mode: "mock" });
    const result = await runner.run({
      prompt: "Add authentication",
      cwd: "/tmp/demo",
      role: "planner",
      missionId: "mis_1",
      stepName: "Add authentication"
    });
    expect(result.plannedSteps?.length).toBe(3);
    expect(result.plannedSteps?.[1]?.name).toBe("auth-strategy");
  });
});
