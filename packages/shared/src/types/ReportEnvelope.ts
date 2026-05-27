export type ReportEnvelope = {
  version: "nexora-report-v1";
  runId: string;
  agentId: string;
  harnessId: string;
  objective: string;
  createdAt: string;
  intentHash?: `0x${string}`;
  proposalHash?: `0x${string}`;
  riskReportHash?: `0x${string}`;
  benchmarkHash?: `0x${string}`;
  modelHash?: `0x${string}`;
  toolTraceHash: `0x${string}`;
  reportHash: `0x${string}`;
};
