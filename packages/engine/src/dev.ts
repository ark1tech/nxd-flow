import { createAutopilot } from "./index.js";
import { loadAutopilotConfig } from "./config.js";
import { resolveWorkspaceRoot } from "./paths.js";

const root = resolveWorkspaceRoot(process.cwd());
const config = loadAutopilotConfig(root);
const port = config.port;
const { gateway } = createAutopilot(root);
gateway.listen(port);
console.log(`Autopilot engine listening on http://localhost:${port}`);
