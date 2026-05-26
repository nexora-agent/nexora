import type { ToolTraceEntry } from "./McpTool";
import type { TransactionIntent } from "./TransactionIntent";

export type AgentProposal = {
  id: string;
  agentId: string;
  harnessId: string;
  actionType: string;
  target: `0x${string}`;
  token: string;
  amount: string;
  asset?: string;
  executionMode?: string;
  expectedYield?: string;
  liveExecutionEnabled?: boolean;
  mode?: string;
  poolName?: string;
  protocol?: string;
  reasoning: string;
  rejectedOptions?: Array<{ name: string; reason: string }>;
  riskHints?: string[];
  targetVault?: string;
  intentHash: `0x${string}`;
  intent: TransactionIntent;
  toolTrace: ToolTraceEntry[];
};
