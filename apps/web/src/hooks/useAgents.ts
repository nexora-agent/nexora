"use client";

import type { AgentRecord } from "@nexora/shared";
import { useCallback, useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { listSmartWalletProfilesOnchain } from "@/lib/contracts/onchainSmartWallets";

export function useAgents() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { address } = useWalletConnection();

  const refreshAgents = useCallback(async () => {
    setLoaded((wasLoaded) => wasLoaded);
    try {
      setAgents(await listSmartWalletProfilesOnchain(address));
    } catch {
      setAgents((currentAgents) => currentAgents);
    } finally {
      setLoaded(true);
    }
  }, [address]);

  useEffect(() => {
    refreshAgents();

    window.addEventListener("focus", refreshAgents);

    return () => {
      window.removeEventListener("focus", refreshAgents);
    };
  }, [refreshAgents]);

  return {
    agents,
    hasAgents: agents.length > 0,
    loaded,
    refreshAgents,
  };
}
