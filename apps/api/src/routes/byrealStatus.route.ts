import type { FastifyInstance } from "fastify";
import { demoPolicy, hashIntent, type PolicyProfile } from "@nexora/shared";
import { analyzeRisk } from "../risk/riskEngine";
import { parseMntAmount } from "../benchmark/mntVaults";
import {
  compareByrealOpportunitiesReadOnly,
  createByrealActionPreview,
  getByrealOverviewReadOnly,
  inspectByrealPoolReadOnly,
  listByrealPoolsReadOnly,
} from "../integrations/byreal/byrealAdapter";
import { getByrealStatus } from "../integrations/byreal/byrealStatus";

export async function byrealStatusRoute(app: FastifyInstance) {
  app.get("/integrations/byreal/status", async () => getByrealStatus());
  app.get("/integrations/byreal/overview", async () => getByrealOverviewReadOnly());
  app.get("/integrations/byreal/pools", async () => listByrealPoolsReadOnly());
  app.get<{
    Params: { poolId: string };
  }>("/integrations/byreal/pools/:poolId", async (request) =>
    inspectByrealPoolReadOnly(request.params.poolId),
  );
  app.post("/integrations/byreal/opportunities/compare", async () =>
    compareByrealOpportunitiesReadOnly(),
  );
  app.post<{
    Body: { amount?: string; poolId?: string };
  }>("/integrations/byreal/intents/preview", async (request) =>
    createByrealActionPreview(request.body?.poolId, request.body?.amount ?? "0.01"),
  );
  app.post<{
    Body: {
      agentId?: string;
      amount?: string;
      poolId?: string;
      policy?: PolicyProfile;
      walletAddress?: `0x${string}`;
    };
  }>("/integrations/byreal/risk/analyze", async (request) => {
    const preview = await createByrealActionPreview(
      request.body?.poolId,
      request.body?.amount ?? "0.01",
    );
    const amount = preview.result.amount;
    const intentWithoutHash = {
      agentId: request.body?.agentId ?? "byreal-scout",
      amount,
      amountBaseUnits: parseMntAmount(amount),
      calldata: "0x" as const,
      chainId: 5003,
      kind: "byreal_lp_deposit_preview" as const,
      metadata: {
        asset: preview.result.asset,
        executionMode: "dry_run" as const,
        expectedYield: preview.result.expectedYield,
        liveExecutionEnabled: false,
        mode: preview.mode,
        poolName: preview.result.poolName,
        protocol: "byreal",
        riskHints: preview.result.riskHints,
      },
      summary: `Dry-run Byreal / RealClaw LP preview for ${amount} MNT in ${preview.result.poolName}`,
      target: preview.result.target,
      tokenAddress: "0x0000000000000000000000000000000000000000" as const,
      tokenDecimals: 18,
      tokenSymbol: "MNT",
    };
    const intent = {
      ...intentWithoutHash,
      intentHash: hashIntent(intentWithoutHash),
    };
    const report = analyzeRisk(
      intent,
      request.body?.policy ?? demoPolicy,
      request.body?.walletAddress,
    );

    return {
      preview,
      report,
    };
  });
}
