import cors from "@fastify/cors";
import Fastify from "fastify";
import { analyzeIntentRoute } from "./routes/analyzeIntent.route";
import { analyzeRiskRoute } from "./routes/analyzeRisk.route";
import { analyzeTaskRoute } from "./routes/analyzeTask.route";
import { byrealStatusRoute } from "./routes/byrealStatus.route";
import { healthRoute } from "./routes/health.route";
import { localHarnessRoute } from "./routes/localHarness.route";
import { nexoraMcpServer } from "./mcp/nexoraMcpServer";
import { runnerControlRoute } from "./routes/runnerControl.route";
import { runObjectiveRoute } from "./routes/runObjective.route";

function corsOrigins() {
  const configured = process.env.NEXORA_CORS_ORIGINS;

  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: corsOrigins(),
});

await app.register(healthRoute);
await app.register(analyzeTaskRoute);
await app.register(analyzeIntentRoute);
await app.register(analyzeRiskRoute);
await app.register(byrealStatusRoute);
await app.register(localHarnessRoute);
await app.register(nexoraMcpServer);
await app.register(runObjectiveRoute);
await app.register(runnerControlRoute);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
