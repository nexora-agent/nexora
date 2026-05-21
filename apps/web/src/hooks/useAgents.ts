"use client";

import type { AgentRecord } from "@nexora/shared";
import { useCallback, useEffect, useState } from "react";
import { listLocalAgents } from "@/lib/agents/localAgentRegistry";

export function useAgents() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshAgents = useCallback(() => {
    setAgents(listLocalAgents());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refreshAgents();

    window.addEventListener("focus", refreshAgents);
    window.addEventListener("storage", refreshAgents);

    return () => {
      window.removeEventListener("focus", refreshAgents);
      window.removeEventListener("storage", refreshAgents);
    };
  }, [refreshAgents]);

  return {
    agents,
    hasAgents: agents.length > 0,
    loaded,
    refreshAgents,
  };
}
