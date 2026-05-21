"use client";

import type { AgentRecord } from "@nexora/shared";
import { useCallback, useEffect, useState } from "react";
import { getLocalAgent } from "@/lib/agents/localAgentRegistry";

export function useAgentProfile(agentId: string) {
  const [agent, setAgent] = useState<AgentRecord | undefined>();
  const [loaded, setLoaded] = useState(false);

  const refreshAgent = useCallback(() => {
    setAgent(getLocalAgent(agentId));
    setLoaded(true);
  }, [agentId]);

  useEffect(() => {
    refreshAgent();

    window.addEventListener("focus", refreshAgent);
    window.addEventListener("storage", refreshAgent);

    return () => {
      window.removeEventListener("focus", refreshAgent);
      window.removeEventListener("storage", refreshAgent);
    };
  }, [refreshAgent]);

  return {
    agent,
    loaded,
    refreshAgent,
  };
}
