import type { FastifyInstance } from "fastify";
import {
  generateBenchmarkDraft,
  getRunnerConfig,
  getRunnerLogs,
  getRunnerStatus,
  runAgentOnce,
  startAutoRunner,
  stopAutoRunner,
  testBenchmark,
  testMcpServer,
  testModel,
  updateRunnerConfig,
  type BenchmarkDraftInput,
  type RunnerConfig,
} from "../runner/runnerControlService";

export async function runnerControlRoute(app: FastifyInstance) {
  const badRequest = (error: unknown) => ({
    message: error instanceof Error ? error.message : "Runner request failed.",
    ok: false,
  });

  app.get("/runner/status", async () => getRunnerStatus());

  app.get("/runner/config", async () => getRunnerConfig());

  app.post<{ Body: Partial<RunnerConfig> }>("/runner/config", async (request) =>
    updateRunnerConfig(request.body ?? {}),
  );

  app.post<{ Body: Partial<RunnerConfig> | undefined }>("/runner/test-model", async (request, reply) => {
    try {
      if (request.body) updateRunnerConfig(request.body);
      return await testModel();
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Body: Partial<RunnerConfig> | undefined }>("/runner/test-benchmark", async (request, reply) => {
    try {
      if (request.body) updateRunnerConfig(request.body);
      return await testBenchmark();
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Body: BenchmarkDraftInput }>("/runner/generate-benchmark", async (request, reply) => {
    try {
      return await generateBenchmarkDraft(request.body ?? {});
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Body: { url?: string } }>("/runner/test-mcp", async (request, reply) => {
    if (!request.body?.url) {
      throw new Error("MCP URL is required.");
    }

    try {
      return await testMcpServer(request.body.url);
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post("/runner/run-once", async () => runAgentOnce());

  app.post("/runner/start", async () => startAutoRunner());

  app.post("/runner/stop", async () => stopAutoRunner());

  app.get<{ Querystring: { limit?: string } }>("/runner/logs", async (request) => ({
    logs: getRunnerLogs(Number(request.query.limit ?? "120")),
  }));
}
