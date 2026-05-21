import { createHash } from "node:crypto";
import type { ObjectiveRun, OnchainReportRecord } from "@nexora/shared";

function hashReportPayload(payload: unknown): `0x${string}` {
  return `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function buildRegistryRecord(run: ObjectiveRun): OnchainReportRecord | undefined {
  if (!run.intent || !run.riskReport || !run.benchmarkScore) {
    return undefined;
  }

  const record = {
    agentId: run.agentId,
    harnessId: run.harnessId,
    objectiveRunId: run.id,
    intentHash: run.intent.intentHash,
    riskScore: run.riskReport.riskScore,
    policyDecision: run.riskReport.policyDecision,
    benchmarkScore: run.benchmarkScore.finalScore,
  };

  return {
    ...record,
    reportHash: hashReportPayload(record),
  };
}
