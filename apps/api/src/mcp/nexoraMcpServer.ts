import type { FastifyInstance } from "fastify";
import type { PolicyProfile } from "@nexora/shared";
import { runAgent } from "../agent/agentRunner";
import { listToolsForHarness } from "./toolRegistry";

type RunAgentBody = {
  agentId: string;
  agentName?: string;
  harnessId: string;
  policy: PolicyProfile;
  task: string;
  tokenAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
};

export async function nexoraMcpServer(app: FastifyInstance) {
  app.get<{ Params: { harnessId: string } }>(
    "/mcp/tools/:harnessId",
    async (request) => ({
      tools: listToolsForHarness(request.params.harnessId),
    }),
  );

  app.post<{ Body: RunAgentBody }>("/mcp/run-agent", async (request, reply) => {
    try {
      return runAgent(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not run agent.",
      });
    }
  });
}
