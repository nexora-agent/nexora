import type { FastifyInstance } from "fastify";
import type { PolicyProfile } from "@nexora/shared";
import { runObjective } from "../agent/objectiveRunner";

type RunObjectiveBody = {
  agentId: string;
  agentName?: string;
  harnessId: string;
  objective: string;
  policy: PolicyProfile;
  tokenAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
};

export async function runObjectiveRoute(app: FastifyInstance) {
  app.post<{ Body: RunObjectiveBody }>("/run-objective", async (request, reply) => {
    try {
      return {
        run: runObjective(request.body),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not run objective.",
      });
    }
  });
}
