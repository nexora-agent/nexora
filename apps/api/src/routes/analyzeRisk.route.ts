import type { FastifyInstance } from "fastify";
import type { PolicyProfile, TransactionIntent } from "@nexora/shared";
import { analyzeRisk } from "../risk/riskEngine";

type AnalyzeRiskBody = {
  intent: TransactionIntent;
  policy: PolicyProfile;
  walletAddress?: `0x${string}`;
};

export async function analyzeRiskRoute(app: FastifyInstance) {
  app.post<{ Body: AnalyzeRiskBody }>("/analyze-risk", async (request) => ({
    report: analyzeRisk(
      request.body.intent,
      request.body.policy,
      request.body.walletAddress,
    ),
  }));
}
