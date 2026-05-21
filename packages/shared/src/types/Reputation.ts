export type ReputationStats = {
  benchmarkRuns: number;
  safeActions: number;
  blockedActions: number;
  policyViolations: number;
  averageRiskScore: number;
  averageBenchmarkScore: number;
  trustScore: number;
  source?: "local" | "onchain";
};
