export type TransactionIntentKind =
  | "erc20_transfer"
  | "erc20_approval"
  | "mnt_vault_deposit"
  | "mnt_vault_withdraw"
  | "mnt_vault_reject"
  | "byreal_pool_inspection"
  | "byreal_swap_preview"
  | "byreal_lp_deposit_preview"
  | "byreal_action_reject";

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
    expectedYield?: string;
    executionMode?: "read_only" | "dry_run" | "disabled";
    liveExecutionEnabled?: boolean;
    mode?:
      | "demo"
      | "api_read_only"
      | "cli_read_only"
      | "cli_dry_run"
      | "disabled"
      | "live";
    modelDecisionSource?: "demo" | "llm";
    modelFailure?: boolean;
    modelGraderWarnings?: string[];
    modelHallucination?: boolean;
    modelInconsistent?: boolean;
    modelLatencyMs?: number;
    modelName?: string;
    modelPrompt?: string;
    modelRawResponse?: string;
    modelReasoning?: string;
    modelRejectedVaults?: string[];
    modelSelectedVault?: string;
    poolName?: string;
    protocol?: "byreal" | string;
    rejectedOptions?: Array<{ name: string; reason: string }>;
    riskHints?: string[];
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
