export type TransactionIntentKind = "erc20_transfer" | "erc20_approval";

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
};

export type CreateTransactionIntentInput = {
  agentId: string;
  chainId: number;
  task: string;
  tokenAddress: `0x${string}`;
  tokenSymbol?: string;
  tokenDecimals?: number;
};
