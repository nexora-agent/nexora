"use client";

import type { AgentRecord } from "@nexora/shared";
import { useEffect, useState } from "react";
import type { ReputationStats as ReputationStatsType } from "@nexora/shared";
import { readReputationStatsOnchain } from "@/lib/contracts/onchainReputation";
import { calculateReputation } from "@/lib/reputation/calculateReputation";
import { ReputationEventTable } from "./ReputationEventTable";
import { ReputationStats } from "./ReputationStats";
import { TrustScoreCard } from "./TrustScoreCard";

type ReputationPanelProps = {
  agent: AgentRecord;
};

export function ReputationPanel({ agent }: ReputationPanelProps) {
  const localStats = calculateReputation(agent.objectiveRuns);
  const [onchainStats, setOnchainStats] = useState<ReputationStatsType>();
  const stats = onchainStats?.benchmarkRuns ? onchainStats : localStats;

  useEffect(() => {
    let cancelled = false;

    if (!agent.identityTransactionHash) {
      setOnchainStats(undefined);
      return;
    }

    readReputationStatsOnchain(agent.id)
      .then((result) => {
        if (!cancelled) {
          setOnchainStats(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnchainStats(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agent.id, agent.identityTransactionHash, agent.objectiveRuns]);

  return (
    <section className="reputation-panel" aria-label="Smart wallet reputation">
      <div className="console-topline">
        <span>Reputation</span>
        <span className="status-pill status-ready">
          {stats.source === "onchain" ? "On-chain" : "Local"}
        </span>
      </div>
      <TrustScoreCard stats={stats} />
      <ReputationStats stats={stats} />
      <ReputationEventTable runs={agent.objectiveRuns ?? []} />
    </section>
  );
}
