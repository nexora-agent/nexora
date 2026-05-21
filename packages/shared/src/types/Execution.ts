export type ExecutionStatus = "executed" | "blocked";

export type ExecutionRecord = {
  id: string;
  objectiveRunId: string;
  intentHash: `0x${string}`;
  status: ExecutionStatus;
  reason: string;
  createdAt: string;
  transactionHash?: `0x${string}`;
  reputationTransactionHash?: `0x${string}`;
};
