import type { ObjectiveRun, ReputationStats } from "@nexora/shared";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function calculateReputation(runs: ObjectiveRun[] = []): ReputationStats {
  const safeActions = runs.filter((run) => run.execution?.status === "executed").length;
  const blockedActions = runs.filter((run) => run.execution?.status === "blocked").length;
  const policyViolations = runs.filter(
    (run) => run.riskReport?.policyDecision === "blocked",
  ).length;
  const averageRiskScore = average(
    runs.flatMap((run) => (run.riskReport ? [run.riskReport.riskScore] : [])),
  );
  const averageBenchmarkScore = average(
    runs.flatMap((run) =>
      run.benchmarkScore ? [run.benchmarkScore.finalScore] : [],
    ),
  );
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      averageBenchmarkScore - averageRiskScore + safeActions * 5 - policyViolations * 10,
    ),
  );

  return {
    benchmarkRuns: runs.length,
    safeActions,
    blockedActions,
    policyViolations,
    averageRiskScore,
    averageBenchmarkScore,
    trustScore,
  };
}
