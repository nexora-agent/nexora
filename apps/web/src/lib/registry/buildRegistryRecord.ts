import type { ObjectiveRun, OnchainReportRecord } from "@nexora/shared";
import { hashIntent } from "@nexora/shared";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";

export function buildRegistryRecord(run: ObjectiveRun): OnchainReportRecord | undefined {
  if (!run.intent || !run.riskReport || !run.benchmarkScore) {
    return undefined;
  }

  const reportHash = hashIntent({
    ...run.intent,
    amount: String(run.benchmarkScore.finalScore),
    summary: `${run.id}:${run.harnessId}:${run.riskReport.riskScore}:${run.benchmarkScore.finalScore}`,
  });

  return {
    agentId: run.agentId,
    harnessId: run.harnessId,
    objectiveRunId: run.id,
    intentHash: run.intent.intentHash,
    riskScore: run.riskReport.riskScore,
    policyDecision: run.riskReport.policyDecision,
    benchmarkScore: run.benchmarkScore.finalScore,
    reportHash,
    registryAddress: mantleSepoliaContracts.riskRegistry,
  };
}
