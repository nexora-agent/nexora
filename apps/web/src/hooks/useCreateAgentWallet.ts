"use client";

import type { AgentRecord } from "@nexora/shared";
import { useState } from "react";
import { createLocalAgentWallet } from "@/lib/agents/localAgentRegistry";
import {
  createAgentWalletOnchain,
  shouldFallbackToDemoWrite,
} from "@/lib/contracts/onchainAgents";

export function useCreateAgentWallet() {
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createAgentWallet = async (
    agent: AgentRecord,
    ownerAddress: `0x${string}`,
  ) => {
    setError("");
    setIsCreating(true);

    try {
      let onchainWallet:
        | Awaited<ReturnType<typeof createAgentWalletOnchain>>
        | undefined;

      if (agent.identityTransactionHash) {
        try {
          onchainWallet = await createAgentWalletOnchain(agent.id);
        } catch (caughtError) {
          if (!shouldFallbackToDemoWrite(caughtError)) {
            throw caughtError;
          }
        }
      }

      return createLocalAgentWallet(
        agent.id,
        ownerAddress,
        onchainWallet?.walletAddress,
        onchainWallet?.transactionHash,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Could not create smart wallet.";
      setError(message);
      throw caughtError;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createAgentWallet,
    error,
    isCreating,
  };
}
