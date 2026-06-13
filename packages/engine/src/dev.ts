import { createAutopilot } from "./index.js";

const port = Number(process.env.AUTOPILOT_PORT ?? 4317);
const { gateway } = createAutopilot(process.cwd());
gateway.listen(port);
console.log(`Autopilot engine listening on http://localhost:${port}`);
