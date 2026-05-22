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
  reasoning: string;
  rejectedOptions?: Array<{ name: string; reason: string }>;
  targetVault?: string;
  intentHash: `0x${string}`;
  intent: TransactionIntent;
  toolTrace: ToolTraceEntry[];
};
