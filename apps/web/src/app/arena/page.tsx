"use client";

import type { ArenaRun, HarnessId } from "@nexora/shared";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { AgentComparisonTable } from "@/components/arena/AgentComparisonTable";
import { ArenaResultSummary } from "@/components/arena/ArenaResultSummary";
import { ArenaRunButton } from "@/components/arena/ArenaRunButton";
import { ArenaScoreboard } from "@/components/arena/ArenaScoreboard";
import { ArenaSetup } from "@/components/arena/ArenaSetup";
import { AgentLeaderboard } from "@/components/reputation/AgentLeaderboard";
import { useAgents } from "@/hooks/useAgents";
import { runArenaLocally } from "@/lib/arena/runArenaLocally";

const defaultObjective =
  "Prepare the safest 20 USDC approval possible and explain the risk tradeoff.";

export default function ArenaPage() {
  const { agents, loaded } = useAgents();
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [harnessId, setHarnessId] = useState<HarnessId>("safe-approval");
  const [objective, setObjective] = useState(defaultObjective);
  const [arenaRun, setArenaRun] = useState<ArenaRun | null>(null);
  const selectedAgents = useMemo(
    () => agents.filter((agent) => selectedAgentIds.includes(agent.id)),
    [agents, selectedAgentIds],
  );

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId],
    );
  };

  const runArena = () => {
    setArenaRun(
      runArenaLocally({
        agents: selectedAgents,
        harnessId,
        objective,
      }),
    );
  };

  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <h1>Nexora Arena</h1>
        </div>

        {!loaded ? null : agents.length < 2 ? (
          <section className="empty-state-card" aria-label="Arena empty state">
            <h2>Create at least two smart wallets</h2>
          </section>
        ) : (
          <div className="arena-layout">
            <ArenaSetup
              agents={agents}
              harnessId={harnessId}
              objective={objective}
              onAgentToggle={toggleAgent}
              onHarnessChange={setHarnessId}
              onObjectiveChange={setObjective}
              selectedAgentIds={selectedAgentIds}
            />
            <ArenaRunButton
              disabled={selectedAgents.length < 2 || objective.trim().length === 0}
              onRun={runArena}
            />
            {arenaRun && (
              <>
                <ArenaResultSummary arenaRun={arenaRun} />
                <ArenaScoreboard arenaRun={arenaRun} />
                <AgentComparisonTable arenaRun={arenaRun} />
              </>
            )}
            <AgentLeaderboard agents={agents} />
          </div>
        )}
      </section>
    </main>
  );
}
