import type { AgentProposal, ToolTraceEntry, TransactionIntent } from "@nexora/shared";

export function planProposal(input: {
  agentId: string;
  harnessId: string;
  intent: TransactionIntent;
  toolTrace: ToolTraceEntry[];
}): AgentProposal {
  return {
    id: `proposal-${input.intent.intentHash.slice(2, 10)}`,
    agentId: input.agentId,
    harnessId: input.harnessId,
    actionType: input.intent.kind,
    target: input.intent.target,
    token: input.intent.tokenSymbol,
    amount: input.intent.amount,
    reasoning:
      input.harnessId === "byreal-defi"
        ? "The agent inspected Byreal-style pool data and proposed a bounded DeFi intent for risk scoring."
        : "The agent used the selected harness tools to convert the objective into a bounded transaction intent.",
    intentHash: input.intent.intentHash,
    intent: input.intent,
    toolTrace: input.toolTrace,
  };
}
