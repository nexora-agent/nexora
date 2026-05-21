export type OnchainReportRecord = {
  agentId: string;
  harnessId: string;
  objectiveRunId: string;
  intentHash: `0x${string}`;
  riskScore: number;
  policyDecision: "passed" | "blocked";
  benchmarkScore: number;
  reportHash: `0x${string}`;
  registryAddress?: `0x${string}`;
};
