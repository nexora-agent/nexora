import type { ObjectiveRun, OnchainReportRecord } from "@nexora/shared";
import { buildReportEnvelope } from "@nexora/shared";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";

export function buildRegistryRecord(run: ObjectiveRun): OnchainReportRecord | undefined {
  if (!run.intent || !run.riskReport || !run.benchmarkScore) {
    return undefined;
  }

  const reportHash = run.reportEnvelope?.reportHash ?? buildReportEnvelope(run).reportHash;

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
