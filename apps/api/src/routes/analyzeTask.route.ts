import type { FastifyInstance } from "fastify";
import { createTransactionIntent } from "@nexora/shared";

type AnalyzeTaskBody = {
  agentId: string;
  chainId: number;
  task: string;
  tokenAddress: `0x${string}`;
  tokenSymbol?: string;
  tokenDecimals?: number;
};

export async function analyzeTaskRoute(app: FastifyInstance) {
  app.post<{ Body: AnalyzeTaskBody }>("/analyze-task", async (request, reply) => {
    try {
      return {
        intent: createTransactionIntent(request.body),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not create intent.",
      });
    }
  });
}
