"use client";

import type { AgentRecord } from "@nexora/shared";
import { useState } from "react";
import { createSmartWalletOnchain } from "@/lib/contracts/onchainSmartWallets";

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
      return await createSmartWalletOnchain(agent, ownerAddress);
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
