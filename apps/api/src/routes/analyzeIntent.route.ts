import type { FastifyInstance } from "fastify";
import { hashIntent, type TransactionIntent } from "@nexora/shared";

export async function analyzeIntentRoute(app: FastifyInstance) {
  app.post<{ Body: Omit<TransactionIntent, "intentHash"> }>(
    "/analyze-intent",
    async (request) => ({
      intentHash: hashIntent(request.body),
    }),
  );
}
