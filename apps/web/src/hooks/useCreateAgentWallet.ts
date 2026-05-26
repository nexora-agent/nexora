"use client";

import type { AgentRecord } from "@nexora/shared";
import { useState } from "react";
import { createSmartWalletOnchain } from "@/lib/contracts/onchainSmartWallets";

function readableCreateWalletError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Could not create smart wallet.";
  }

  if (
    error.message.includes("SmartWalletNotFound") ||
    error.message.includes("0xd7624a57") ||
    error.message.includes("execution reverted")
  ) {
    return "This smart wallet profile is not registered in the current on-chain registry. Create a new smart wallet profile, then deploy its wallet.";
  }

  return error.message;
}

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
      setError(readableCreateWalletError(caughtError));
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
