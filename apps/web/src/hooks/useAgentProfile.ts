"use client";

import type { AgentRecord } from "@nexora/shared";
import { useCallback, useEffect, useState } from "react";
import { getSmartWalletProfileOnchain } from "@/lib/contracts/onchainSmartWallets";

export function useAgentProfile(agentId: string) {
  const [agent, setAgent] = useState<AgentRecord | undefined>();
  const [loaded, setLoaded] = useState(false);

  const refreshAgent = useCallback(async () => {
    setLoaded((wasLoaded) => wasLoaded);
    try {
      setAgent(await getSmartWalletProfileOnchain(agentId));
    } catch {
      setAgent((currentAgent) => currentAgent);
    } finally {
      setLoaded(true);
    }
  }, [agentId]);

  useEffect(() => {
    refreshAgent();

    window.addEventListener("focus", refreshAgent);
    return () => {
      window.removeEventListener("focus", refreshAgent);
    };
  }, [refreshAgent]);

  return {
    agent,
    loaded,
    refreshAgent,
  };
}
