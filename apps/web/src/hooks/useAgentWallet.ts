"use client";

import type { AgentRecord } from "@nexora/shared";
import { useWalletBalance } from "./useWalletBalance";

export function useAgentWallet(agent: AgentRecord) {
  const balance = useWalletBalance(agent.walletAddress);

  return {
    agentWalletAddress: agent.walletAddress,
    balance,
    hasAgentWallet: Boolean(agent.walletAddress),
    needsFunding: Boolean(agent.walletAddress) && balance.isZeroBalance,
  };
}
