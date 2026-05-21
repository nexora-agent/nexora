import type { ExecutionRecord, ObjectiveRun, PolicyProfile } from "@nexora/shared";

export function gateExecution(run: ObjectiveRun, policy: PolicyProfile): ExecutionRecord {
  const now = new Date().toISOString();
  const intentHash = run.intent?.intentHash ?? "0x0";
  const base = {
    id: `execution-${Date.now()}`,
    objectiveRunId: run.id,
    intentHash,
    createdAt: now,
  };

  if (!run.proposal || !run.riskReport) {
    return {
      ...base,
      status: "blocked",
      reason: "Missing proposal or risk report.",
    };
  }

  if (run.proposal.intentHash !== run.riskReport.intentHash) {
    return {
      ...base,
      status: "blocked",
      reason: "Tampered intent blocked: proposal and report hashes do not match.",
    };
  }

  if (run.riskReport.policyDecision !== "passed") {
    return {
      ...base,
      status: "blocked",
      reason: "Policy decision blocked execution.",
    };
  }

  if (run.riskReport.riskScore > policy.maxRiskScore) {
    return {
      ...base,
      status: "blocked",
      reason: "Risk score is above the active policy threshold.",
    };
  }

  return {
    ...base,
    status: "executed",
    reason: "Policy report verified; execution allowed.",
  };
}
