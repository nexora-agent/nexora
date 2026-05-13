export type TransactionIntentKind = "erc20_transfer" | "erc20_approval";

export type TransactionIntent = {
  kind: TransactionIntentKind;
  chainId: number;
  agentId: string;
  target: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount: string;
  calldata?: `0x${string}`;
  intentHash?: `0x${string}`;
};
