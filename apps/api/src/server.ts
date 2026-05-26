import cors from "@fastify/cors";
import Fastify from "fastify";
import { analyzeIntentRoute } from "./routes/analyzeIntent.route";
import { analyzeRiskRoute } from "./routes/analyzeRisk.route";
import { analyzeTaskRoute } from "./routes/analyzeTask.route";
import { byrealStatusRoute } from "./routes/byrealStatus.route";
import { healthRoute } from "./routes/health.route";
import { localHarnessRoute } from "./routes/localHarness.route";
import { nexoraMcpServer } from "./mcp/nexoraMcpServer";
import { runObjectiveRoute } from "./routes/runObjective.route";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

await app.register(healthRoute);
await app.register(analyzeTaskRoute);
await app.register(analyzeIntentRoute);
await app.register(analyzeRiskRoute);
await app.register(byrealStatusRoute);
await app.register(localHarnessRoute);
await app.register(nexoraMcpServer);
await app.register(runObjectiveRoute);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
