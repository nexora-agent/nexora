import type { ObjectiveRun, OnchainReportRecord } from "@nexora/shared";
import { buildReportEnvelope } from "@nexora/shared";

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

  const reportHash = run.reportEnvelope?.reportHash ?? buildReportEnvelope(run).reportHash;

  return {
    ...record,
    reportHash,
  };
}
