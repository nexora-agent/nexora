import { keccak256, toBytes } from "viem";
import type { ObjectiveRun } from "../types/ObjectiveRun";
import type { ReportEnvelope } from "../types/ReportEnvelope";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }

  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function hashCanonical(value: unknown): `0x${string}` {
  return keccak256(toBytes(stableStringify(value)));
}

export function buildReportEnvelope(run: ObjectiveRun): ReportEnvelope {
  const proposalHash = run.proposal
    ? hashCanonical({
        actionType: run.proposal.actionType,
        amount: run.proposal.amount,
        intentHash: run.proposal.intentHash,
        reasoning: run.proposal.reasoning,
        rejectedOptions: run.proposal.rejectedOptions,
        target: run.proposal.target,
        targetVault: run.proposal.targetVault,
        token: run.proposal.token,
      })
    : undefined;
  const riskReportHash = run.riskReport
    ? hashCanonical({
        flags: run.riskReport.flags.map((flag) => ({
          code: flag.code,
          scoreImpact: flag.scoreImpact,
          severity: flag.severity,
        })),
        intentHash: run.riskReport.intentHash,
        policyDecision: run.riskReport.policyDecision,
        riskLevel: run.riskReport.riskLevel,
        riskScore: run.riskReport.riskScore,
      })
    : undefined;
  const benchmarkHash = run.benchmarkScore
    ? hashCanonical(run.benchmarkScore)
    : undefined;
  const modelHash = run.intent?.metadata
    ? hashCanonical({
        benchmarkLevel: run.intent.metadata.benchmarkLevel,
        benchmarkName: run.intent.metadata.benchmarkName,
        benchmarkUnlock: run.intent.metadata.benchmarkUnlock,
        connectionMode: run.intent.metadata.mode,
        modelDecisionSource: run.intent.metadata.modelDecisionSource,
        modelName: run.intent.metadata.modelName,
        modelSelectedVault: run.intent.metadata.modelSelectedVault,
      })
    : undefined;
  const toolTraceHash = hashCanonical(
    run.toolTrace.map((entry) => ({
      index: entry.index,
      status: entry.status,
      summary: entry.summary,
      toolName: entry.toolName,
    })),
  );
  const envelopeWithoutHash = {
    agentId: run.agentId,
    benchmarkHash,
    createdAt: run.createdAt,
    harnessId: run.harnessId,
    intentHash: run.intent?.intentHash,
    modelHash,
    objective: run.objective,
    proposalHash,
    riskReportHash,
    runId: run.id,
    toolTraceHash,
    version: "nexora-report-v1" as const,
  };

  return {
    ...envelopeWithoutHash,
    reportHash: hashCanonical(envelopeWithoutHash),
  };
}

export function attachReportEnvelope(run: ObjectiveRun): ObjectiveRun {
  return {
    ...run,
    reportEnvelope: buildReportEnvelope(run),
  };
}
