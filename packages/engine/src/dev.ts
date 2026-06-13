import { createAutopilot } from "./index.js";
import { loadAutopilotConfig } from "./config.js";

const config = loadAutopilotConfig(process.cwd());
const port = config.port;
const { gateway } = createAutopilot(process.cwd());
gateway.listen(port);
console.log(`Autopilot engine listening on http://localhost:${port}`);
