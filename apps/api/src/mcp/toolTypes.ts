import type {
  McpToolDefinition,
  PolicyProfile,
  ToolTraceEntry,
  TransactionIntent,
} from "@nexora/shared";

export type ToolContext = {
  agentId: string;
  agentName?: string;
  harnessId: string;
  walletAddress?: `0x${string}`;
  policy: PolicyProfile;
};

export type ToolExecutionState = {
  intent?: TransactionIntent;
  byrealPoolId?: string;
};

export type ToolInput = {
  task?: string;
  tokenAddress?: `0x${string}`;
  tokenSymbol?: string;
  tokenDecimals?: number;
};

export type ToolResult = {
  summary: string;
  data?: unknown;
};

export type NexoraTool = McpToolDefinition & {
  execute: (
    context: ToolContext,
    input: ToolInput,
    state: ToolExecutionState,
  ) => ToolResult;
};

export type ToolLoopResult = {
  intent?: TransactionIntent;
  report?: unknown;
  toolTrace: ToolTraceEntry[];
};
