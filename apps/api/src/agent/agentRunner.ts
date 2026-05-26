import type { PolicyProfile } from "@nexora/shared";
import { runToolLoop } from "./toolLoop";

export type AgentRunnerInput = {
  agentId: string;
  agentName?: string;
  harnessId: string;
  policy: PolicyProfile;
  task: string;
  tokenAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
};

export async function runAgent(input: AgentRunnerInput) {
  return runToolLoop(
    {
      agentId: input.agentId,
      agentName: input.agentName,
      harnessId: input.harnessId,
      policy: input.policy,
      walletAddress: input.walletAddress,
    },
    {
      task: input.task,
      tokenAddress: input.tokenAddress,
      tokenDecimals: 6,
      tokenSymbol: "USDC",
    },
  );
}
