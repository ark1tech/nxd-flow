#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAutopilot } from "@autopilot/engine";

export { AutopilotMcpServer } from "@autopilot/engine";

export function createAutopilotStdioServer(root = process.env.AUTOPILOT_ROOT ?? process.cwd()): McpServer {
  const { store, engine } = createAutopilot(root);
  const server = new McpServer({ name: "autopilot", version: "0.1.0" });
  const looseInput = z.object({}).passthrough();

  for (const name of engine.mcp.toolNames()) {
    server.registerTool(
      name,
      {
        title: name,
        description: `Autopilot tool: ${name}`,
        inputSchema: looseInput
      },
      async (args) => {
        const result = engine.mcp.callTool(name, args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }
    );
  }

  process.once("exit", () => store.close());
  return server;
}

if (process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")) {
  const server = createAutopilotStdioServer();
  await server.connect(new StdioServerTransport());
}
