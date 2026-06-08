"use client";

import type { AgentRecord, ReputationStats as ReputationStatsType } from "@nexora/shared";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import type { OnchainRunnerActivity } from "@/hooks/useOnchainRunnerActivity";
import { mantleExplorerTxUrl } from "@/lib/chains/explorer";
import { readAutonomyStateOnchain, type AutonomyOnchainState } from "@/lib/contracts/onchainAutonomy";
import { readReputationStatsOnchain } from "@/lib/contracts/onchainReputation";

type OnchainAgentReportPanelProps = {
  activity?: OnchainRunnerActivity;
  agent: AgentRecord;
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

function formatAddress(address?: string) {
  if (!address || address.toLowerCase() === zeroAddress) {
    return "Not set";
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatAgentId(agent: AgentRecord) {
  const id = agent.agentIdentityId ?? agent.id;
  return id ? `ERC-8004 #${id}` : "Not registered";
}

function formatMnt(value?: string) {
  if (!value) {
    return "0 MNT";
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return `${value} MNT`;
  }

  return `${parsed.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} MNT`;
}

function formatExpiryDate(validUntil?: number) {
  if (!validUntil) {
    return "No expiry set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(validUntil * 1000));
}

function formatTimeRemaining(validUntil?: number) {
  if (!validUntil) {
    return "No active time window";
  }

  const remainingMs = validUntil * 1000 - Date.now();

  if (remainingMs <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

function isExpired(validUntil?: number) {
  if (!validUntil) {
    return false;
  }

  return Date.now() > validUntil * 1000;
}

function executorStatus(state?: AutonomyOnchainState) {
  if (!state) {
    return "Not configured";
  }

  if (!state.enabled) {
    return "Disabled";
  }

  if (isExpired(state.validUntil)) {
    return "Expired";
  }

  return "Enabled";
}

function emptyStats(): ReputationStatsType {
  return {
    averageBenchmarkScore: 0,
    averageRiskScore: 0,
    benchmarkRuns: 0,
    blockedActions: 0,
    policyViolations: 0,
    safeActions: 0,
    source: "onchain",
    trustScore: 0,
  };
}

export function OnchainAgentReportPanel({ activity, agent }: OnchainAgentReportPanelProps) {
  const agentId = agent.agentIdentityId ?? agent.id;
  const [stats, setStats] = useState<ReputationStatsType>(emptyStats);
  const [autonomy, setAutonomy] = useState<AutonomyOnchainState>();
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const walletAddress = agent.walletAddress as Address | undefined;

  const allowedTargets = useMemo(() => {
    const rows = autonomy?.allowedTargets ?? [];
    return rows.filter((target) => target.allowed);
  }, [autonomy]);

  const hasOnchainRecords =
    stats.benchmarkRuns > 0 ||
    stats.safeActions > 0 ||
    stats.blockedActions > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      setIsLoading(true);
      setNotice("");

      try {
        const [nextStats, nextAutonomy] = await Promise.all([
          readReputationStatsOnchain(agentId).catch(() => emptyStats()),
          walletAddress
            ? readAutonomyStateOnchain({
                agentId,
                walletAddress,
              }).catch(() => undefined)
            : Promise.resolve(undefined),
        ]);

        if (cancelled) {
          return;
        }

        setStats(nextStats);
        setAutonomy(nextAutonomy);
      } catch {
        if (!cancelled) {
          setNotice("Could not load on-chain report data.");
          setStats(emptyStats());
          setAutonomy(undefined);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [agentId, walletAddress]);

  return (
    <section className="summary-card" aria-label="On-chain agent report">
      <div className="console-topline">
        <span>On-chain Report</span>
        <span className={`status-pill ${hasOnchainRecords ? "status-ready" : "status-disconnected"}`}>
          {hasOnchainRecords ? "Mantle records" : "No records"}
        </span>
      </div>

      {notice && <p className="error-text">{notice}</p>}

      <dl>
        <div>
          <dt>Agent ID</dt>
          <dd>{formatAgentId(agent)}</dd>
        </div>

        <div>
          <dt>Smart wallet</dt>
          <dd>{formatAddress(walletAddress)}</dd>
        </div>

        <div>
          <dt>Executor</dt>
          <dd>
            {formatAddress(autonomy?.executor)} · {executorStatus(autonomy)}
          </dd>
        </div>

        <div>
          <dt>Executor budget</dt>
          <dd>{formatMnt(autonomy?.dailyLimitMnt)} / day</dd>
        </div>

        <div>
          <dt>Used today</dt>
          <dd>{formatMnt(autonomy?.spentTodayMnt)}</dd>
        </div>

        <div>
          <dt>Remaining today</dt>
          <dd>{formatMnt(autonomy?.remainingTodayMnt)}</dd>
        </div>

        <div>
          <dt>Max action size</dt>
          <dd>{formatMnt(autonomy?.maxValuePerActionMnt)} / action</dd>
        </div>

        <div>
          <dt>Works until</dt>
          <dd>{formatExpiryDate(autonomy?.validUntil)}</dd>
        </div>

        <div>
          <dt>Time remaining</dt>
          <dd>{formatTimeRemaining(autonomy?.validUntil)}</dd>
        </div>

        <div>
          <dt>Preflight required</dt>
          <dd>{autonomy?.requirePreflight ? "Yes" : "No"}</dd>
        </div>

        <div>
          <dt>Reporter authorized</dt>
          <dd>{autonomy?.reporterAuthorized ? "Yes" : "No"}</dd>
        </div>

        <div>
          <dt>Benchmark runs</dt>
          <dd>{isLoading ? "Loading..." : stats.benchmarkRuns}</dd>
        </div>

        <div>
          <dt>Safe executions</dt>
          <dd>{isLoading ? "Loading..." : stats.safeActions}</dd>
        </div>

        <div>
          <dt>Blocked executions</dt>
          <dd>{isLoading ? "Loading..." : stats.blockedActions}</dd>
        </div>

        <div>
          <dt>Average score</dt>
          <dd>{isLoading ? "Loading..." : stats.averageBenchmarkScore}</dd>
        </div>

        <div>
          <dt>Trust score</dt>
          <dd>{isLoading ? "Loading..." : stats.trustScore}</dd>
        </div>

        <div>
          <dt>Allowed targets</dt>
          <dd>
            {allowedTargets.length === 0 ? (
              "No allowed targets"
            ) : (
              <ul className="tool-trace-list">
                {allowedTargets.slice(0, 6).map((target) => (
                  <li key={target.address}>
                    <strong>{target.label}</strong>
                    <span>{formatAddress(target.address)}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>

        <div>
          <dt>Latest status</dt>
          <dd>
            {hasOnchainRecords
              ? "Agent has benchmark/execution records on Mantle"
              : "No on-chain records yet"}
          </dd>
        </div>
      </dl>

      <section aria-label="On-chain transaction timeline">
        <div className="console-topline">
          <span>Transaction Timeline</span>
          <span className="status-pill status-ready">
            {activity?.timeline?.length ?? 0} tx
          </span>
        </div>

        {!activity?.timeline?.length ? (
          <p>No validation, reputation, or wallet execution transactions found.</p>
        ) : (
          <ol className="tool-trace-list">
            {activity.timeline.slice(0, 10).map((event) => (
              <li key={`${event.type}-${event.txHash}`}>
                <span
                  className={`status-pill ${
                    event.status === "failed" ? "status-blocked" : "status-ready"
                  }`}
                >
                  {event.type}
                </span>

                <div>
                  <strong>{event.label}</strong>
                  {event.value && <small>{event.value}</small>}
                  <a
                    className="secondary-action"
                    href={mantleExplorerTxUrl(event.txHash)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open tx
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
