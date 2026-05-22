export type TransactionIntentKind =
  | "erc20_transfer"
  | "erc20_approval"
  | "mnt_vault_deposit"
  | "mnt_vault_withdraw"
  | "mnt_vault_reject";

export type TransactionIntent = {
  kind: TransactionIntentKind;
  chainId: number;
  agentId: string;
  target: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  amountBaseUnits: string;
  calldata: `0x${string}`;
  intentHash: `0x${string}`;
  summary: string;
  metadata?: {
    asset?: "MNT" | string;
    benchmarkName?: string;
    expectedYieldBps?: number;
    rejectedOptions?: Array<{ name: string; reason: string }>;
    targetVault?: string;
    vaultRiskProfile?: "low" | "medium" | "high";
    verificationStatus?: "verified" | "unknown";
  };
};

export type CreateTransactionIntentInput = {
  agentId: string;
  chainId: number;
  task: string;
  tokenAddress: `0x${string}`;
  tokenSymbol?: string;
  tokenDecimals?: number;
};
