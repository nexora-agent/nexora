"use client";

import type {
  AgentRecord,
  PreflightThresholds,
  ReputationStats as ReputationStatsType,
} from "@nexora/shared";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import type { OnchainRunnerActivity } from "@/hooks/useOnchainRunnerActivity";
import { mantleExplorerTxUrl } from "@/lib/chains/explorer";
import {
  readSmartWalletOnchainReport,
  type SmartWalletOnchainReport,
} from "@/lib/contracts/onchainAgentReport";
import { readAutonomyStateOnchain, type AutonomyOnchainState } from "@/lib/contracts/onchainAutonomy";
import { readPreflightThresholdStateOnchain } from "@/lib/contracts/onchainPreflight";
import { readReputationStatsOnchain } from "@/lib/contracts/onchainReputation";
import { preflightPresetLabel, preflightPresets } from "@/lib/preflight/preflightPolicy";

type OnchainAgentReportPanelProps = {
  activity?: OnchainRunnerActivity;
  activityError?: string;
  activityLoading?: boolean;
  agent: AgentRecord;
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

type ValidationThresholdState = {
  exists: boolean;
  source: "agent-validation" | "preflight-registry";
  thresholds: PreflightThresholds;
};

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function numberFromRecord(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function formatAddress(address?: string) {
  if (!address || address.toLowerCase() === zeroAddress) {
    return "Not set";
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatHash(hash?: string) {
  if (!hash) {
    return "Not recorded";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
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

function formatDateTime(value?: number | string) {
  if (!value) {
    return "Not recorded";
  }

  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAge(timestamp?: number) {
  if (!timestamp) {
    return "No validation yet";
  }

  const elapsedMs = Date.now() - timestamp * 1000;
  if (elapsedMs < 0) {
    return "Just now";
  }

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function benchmarkDecisionThresholdSummary(benchmarkDataJson?: string) {
  if (!benchmarkDataJson) {
    return undefined;
  }

  try {
    const benchmark = recordFromUnknown(JSON.parse(benchmarkDataJson));
    const simulation = recordFromUnknown(benchmark?.simulation);
    const thresholds = recordFromUnknown(simulation?.decisionThresholds);
    const minExpectedEdgeBps = numberFromRecord(
      thresholds,
      "minExpectedEdgeBps",
      "expectedEdgeBpsMin",
    );
    const minLiquidityScore = numberFromRecord(
      thresholds,
      "minLiquidityScore",
      "liquidityScoreMin",
    );
    const maxPriceImpactBps = numberFromRecord(
      thresholds,
      "maxPriceImpactBps",
      "priceImpactBpsMax",
    );
    const maxVolatilityBps = numberFromRecord(
      thresholds,
      "maxVolatilityBps",
      "volatilityBpsMax",
    );
    const parts = [
      minExpectedEdgeBps === undefined
        ? undefined
        : `edge > ${minExpectedEdgeBps} bps`,
      minLiquidityScore === undefined
        ? undefined
        : `liquidity >= ${minLiquidityScore}`,
      maxPriceImpactBps === undefined
        ? undefined
        : `impact <= ${maxPriceImpactBps} bps`,
      maxVolatilityBps === undefined
        ? undefined
        : `volatility <= ${maxVolatilityBps} bps`,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" / ") : undefined;
  } catch {
    return undefined;
  }
}

function thresholdsMatchPreset(
  thresholds: PreflightThresholds,
  preset: PreflightThresholds,
) {
  return (
    thresholds.averageMinScore === preset.averageMinScore &&
    thresholds.maxRiskScore === preset.maxRiskScore &&
    thresholds.freshnessMinutes === preset.freshnessMinutes &&
    thresholds.basicSafetyMinScore === preset.basicSafetyMinScore &&
    thresholds.adversarialYieldTrapMinScore === preset.adversarialYieldTrapMinScore &&
    thresholds.externalDefiReadinessMinScore === preset.externalDefiReadinessMinScore
  );
}

function executionGateLabel(thresholds?: PreflightThresholds) {
  if (!thresholds) {
    return "Not loaded";
  }

  const presetEntry = Object.entries(preflightPresets).find(([, preset]) =>
    thresholdsMatchPreset(thresholds, preset),
  );

  if (presetEntry) {
    return preflightPresetLabel(presetEntry[0] as keyof typeof preflightPresets);
  }

  return "Custom";
}

function executionGateRule(thresholds?: PreflightThresholds) {
  if (!thresholds) {
    return "Not loaded";
  }

  return `Score >= ${thresholds.averageMinScore} / risk <= ${thresholds.maxRiskScore} / proof <= ${thresholds.freshnessMinutes}m old`;
}

function proofGateStatus(requirePreflight?: boolean) {
  return requirePreflight
    ? "Required before executor can spend"
    : "Off";
}

function proofFreshnessSummary(timestamp?: number, freshnessMinutes?: number) {
  if (!timestamp) {
    return "No proof recorded";
  }

  if (!freshnessMinutes) {
    return `${formatAge(timestamp)} · ${formatDateTime(timestamp)}`;
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp * 1000) / 60_000));
  const fresh = elapsedMinutes <= freshnessMinutes;

  return `${fresh ? "Fresh" : "Expired"} · ${formatAge(timestamp)} · max ${freshnessMinutes}m`;
}

function thresholdSourceLabel(state?: ValidationThresholdState) {
  if (!state) {
    return "Not loaded";
  }

  const source =
    state.source === "agent-validation"
      ? "ERC-8004 validation registry"
      : "wallet preflight registry";
  return state.exists ? `Stored in ${source}` : `Default policy from ${source}`;
}

function validationBenchmarkStatus(report?: SmartWalletOnchainReport) {
  if (!report?.latestValidation) {
    return report?.activeBenchmark
      ? "Awaiting first validation for active benchmark"
      : "No validation recorded";
  }

  if (!report.activeBenchmark) {
    return "No active benchmark selected";
  }

  return report.latestValidationMatchesActiveBenchmark
    ? "Matches active benchmark"
    : "Stale or different benchmark";
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

export function OnchainAgentReportPanel({
  activity,
  activityError,
  activityLoading = false,
  agent,
}: OnchainAgentReportPanelProps) {
  const agentId = agent.agentIdentityId ?? agent.id;
  const [stats, setStats] = useState<ReputationStatsType>(emptyStats);
  const [autonomy, setAutonomy] = useState<AutonomyOnchainState>();
  const [onchainReport, setOnchainReport] = useState<SmartWalletOnchainReport>();
  const [thresholdState, setThresholdState] = useState<ValidationThresholdState>();
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const walletAddress = agent.walletAddress as Address | undefined;

  const allowedTargets = useMemo(() => {
    const rows = autonomy?.allowedTargets ?? [];
    return rows.filter((target) => target.allowed);
  }, [autonomy]);

  const benchmarkTargets = useMemo(() => {
    const rows = onchainReport?.activeBenchmark?.targetContracts ?? [];
    return rows.filter((target) => target.toLowerCase() !== zeroAddress);
  }, [onchainReport?.activeBenchmark?.targetContracts]);

  const reportIssues = useMemo(() => {
    const issues: string[] = [];

    if (!onchainReport?.identity) {
      issues.push("ERC-8004 identity record could not be read.");
    } else if (onchainReport.identity.walletMatchesSelected === false) {
      issues.push("Selected smart wallet does not match the ERC-8004 identity wallet.");
    }

    if (!onchainReport?.activeBenchmark) {
      issues.push("No active benchmark is selected for this identity.");
    }

    if (
      onchainReport?.activeBenchmark &&
      onchainReport.latestValidation &&
      onchainReport.latestValidationMatchesActiveBenchmark === false
    ) {
      issues.push("Latest proof was produced for a different benchmark hash.");
    }

    if (!autonomy) {
      issues.push("Executor policy could not be read from the smart wallet.");
    } else {
      if (!autonomy.enabled || autonomy.executor.toLowerCase() === zeroAddress) {
        issues.push("Executor policy is disabled or has no executor address.");
      } else if (isExpired(autonomy.validUntil)) {
        issues.push("Executor policy is expired.");
      }

      if (!autonomy.reporterAuthorized) {
        issues.push("Linked executor is not authorized as a validation reporter.");
      }
    }

    return issues;
  }, [autonomy, onchainReport]);
  const activeBenchmark = onchainReport?.activeBenchmark;
  const identity = onchainReport?.identity;
  const latestValidation = onchainReport?.latestValidation;
  const proofCount =
    onchainReport?.validationCount ?? (latestValidation ? 1 : 0);
  const hasOnchainRecords =
    proofCount > 0 ||
    stats.benchmarkRuns > 0 ||
    stats.safeActions > 0 ||
    stats.blockedActions > 0;
  const reportHealthy = reportIssues.length === 0 && Boolean(identity);
  const reportStatusLabel = isLoading
    ? "Loading"
    : reportIssues.length > 0
      ? "Needs attention"
      : latestValidation
        ? "Verified"
        : "Configured";
  const reportStatusClass = reportIssues.length > 0 ? "status-wrong-network" : "status-ready";
  const benchmarkDecisionThresholds = useMemo(
    () => benchmarkDecisionThresholdSummary(activeBenchmark?.benchmarkDataJson),
    [activeBenchmark?.benchmarkDataJson],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      setIsLoading(true);
      setNotice("");

      try {
        const [nextStats, nextAutonomy, nextReport, nextThresholdState] = await Promise.all([
          readReputationStatsOnchain(agentId).catch(() => emptyStats()),
          walletAddress
            ? readAutonomyStateOnchain({
                agentId,
                walletAddress,
              }).catch(() => undefined)
            : Promise.resolve(undefined),
          readSmartWalletOnchainReport({
            agentId,
            walletAddress,
          }).catch(() => undefined),
          readPreflightThresholdStateOnchain(agentId, {
            useAgentValidation: true,
          }).catch(() => undefined),
        ]);

        if (cancelled) {
          return;
        }

        setStats(nextStats);
        setAutonomy(nextAutonomy);
        setOnchainReport(nextReport);
        setThresholdState(nextThresholdState);
      } catch {
        if (!cancelled) {
          setNotice("Could not load on-chain report data.");
          setStats(emptyStats());
          setAutonomy(undefined);
          setOnchainReport(undefined);
          setThresholdState(undefined);
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
        <span className={`status-pill ${reportStatusClass}`}>
          {reportStatusLabel}
        </span>
      </div>

      {notice && <p className="error-text">{notice}</p>}
      {reportIssues.length > 0 && !isLoading && (
        <ul className="onchain-report-alerts" aria-label="Report issues">
          {reportIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      <dl className="benchmark-debug-grid onchain-report-overview">
        <div>
          <dt>Agent ID</dt>
          <dd>{formatAgentId(agent)}</dd>
        </div>

        <div>
          <dt>Identity owner</dt>
          <dd title={identity?.owner}>
            {isLoading ? "Loading..." : formatAddress(identity?.owner)}
          </dd>
        </div>

        <div>
          <dt>Smart wallet</dt>
          <dd>{formatAddress(walletAddress)}</dd>
        </div>

        <div>
          <dt>Identity wallet</dt>
          <dd title={identity?.registeredWallet}>
            {isLoading ? "Loading..." : formatAddress(identity?.registeredWallet)}
            {identity?.walletMatchesSelected === false ? " · mismatch" : ""}
          </dd>
        </div>
      </dl>

      <div className="onchain-report-sections">
        <section className="onchain-report-section" aria-label="Executor report">
          <div className="console-topline">
            <span>Executor</span>
            <span
              className={`status-pill ${
                executorStatus(autonomy) === "Enabled" ? "status-ready" : "status-wrong-network"
              }`}
            >
              {executorStatus(autonomy)}
            </span>
          </div>

          <dl className="benchmark-debug-grid onchain-report-grid">
            <div>
              <dt>Executor address</dt>
              <dd title={autonomy?.executor}>{formatAddress(autonomy?.executor)}</dd>
            </div>

            <div>
              <dt>Budget</dt>
              <dd>
                {formatMnt(autonomy?.dailyLimitMnt)} / day ·{" "}
                {formatMnt(autonomy?.maxValuePerActionMnt)} / action
              </dd>
            </div>

            <div>
              <dt>Today</dt>
              <dd>
                {formatMnt(autonomy?.spentTodayMnt)} used ·{" "}
                {formatMnt(autonomy?.remainingTodayMnt)} remaining
              </dd>
            </div>

            <div>
              <dt>Works until</dt>
              <dd>
                {formatExpiryDate(autonomy?.validUntil)} ·{" "}
                {formatTimeRemaining(autonomy?.validUntil)}
              </dd>
            </div>

            <div>
              <dt>Benchmark proof gate</dt>
              <dd>{proofGateStatus(autonomy?.requirePreflight)}</dd>
            </div>

            <div>
              <dt>Reporter authorized</dt>
              <dd>{autonomy?.reporterAuthorized ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </section>

        <section className="onchain-report-section" aria-label="Benchmark report">
          <div className="console-topline">
            <span>Benchmark & execution gate</span>
            <span className={`status-pill ${activeBenchmark ? "status-ready" : "status-wrong-network"}`}>
              {activeBenchmark ? "Selected" : "Not selected"}
            </span>
          </div>

          <dl className="benchmark-debug-grid onchain-report-grid">
            <div>
              <dt>Active benchmark</dt>
              <dd>
                {isLoading
                  ? "Loading..."
                  : activeBenchmark
                    ? `${activeBenchmark.name} (#${activeBenchmark.benchmarkId})`
                    : "Not selected"}
              </dd>
            </div>

            <div>
              <dt>Benchmark type</dt>
              <dd>
                {activeBenchmark
                  ? activeBenchmark.benchmarkType
                  : "Not configured"}
              </dd>
            </div>

            <div>
              <dt>Benchmark hash</dt>
              <dd title={activeBenchmark?.benchmarkHash}>
                {formatHash(activeBenchmark?.benchmarkHash)}
              </dd>
            </div>

            {benchmarkDecisionThresholds && (
              <div>
                <dt>Benchmark trading rule</dt>
                <dd>{benchmarkDecisionThresholds}</dd>
              </div>
            )}

            <div>
              <dt>Execution gate</dt>
              <dd>{executionGateLabel(thresholdState?.thresholds)}</dd>
            </div>

            <div>
              <dt>Gate rule</dt>
              <dd>{executionGateRule(thresholdState?.thresholds)}</dd>
            </div>

            <div>
              <dt>Gate source</dt>
              <dd>{thresholdSourceLabel(thresholdState)}</dd>
            </div>

            <div>
              <dt>Last proof result</dt>
              <dd>
                {latestValidation
                  ? `${latestValidation.passed ? "Passed" : "Needs work"} · score ${latestValidation.averageScore} / risk ${latestValidation.maxRiskScore}`
                  : activeBenchmark
                    ? "No benchmark proof recorded"
                    : "No active benchmark"}
              </dd>
            </div>

            <div>
              <dt>Proof freshness</dt>
              <dd>{proofFreshnessSummary(latestValidation?.timestamp, thresholdState?.thresholds.freshnessMinutes)}</dd>
            </div>

            {latestValidation && (
              <>
                <div>
                  <dt>Proof benchmark</dt>
                  <dd>{validationBenchmarkStatus(onchainReport)}</dd>
                </div>

                <div>
                  <dt>Proof hashes</dt>
                  <dd title={`${latestValidation.reportHash} / ${latestValidation.suiteHash}`}>
                    report {formatHash(latestValidation.reportHash)} · suite{" "}
                    {formatHash(latestValidation.suiteHash)}
                  </dd>
                </div>

                <div>
                  <dt>Reporter</dt>
                  <dd title={latestValidation.reporter}>{formatAddress(latestValidation.reporter)}</dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <section className="onchain-report-section" aria-label="Allowed target addresses">
          <div className="console-topline">
            <span>Allowed addresses</span>
            <span className="status-pill status-ready">
              {allowedTargets.length} wallet · {benchmarkTargets.length} benchmark
            </span>
          </div>

          <div className="onchain-address-groups">
            <div>
              <h4>Wallet allowlist</h4>
              {allowedTargets.length === 0 ? (
                <p>No wallet-level allowed targets found.</p>
              ) : (
                <ul className="onchain-address-list">
                  {allowedTargets.slice(0, 8).map((target) => (
                    <li key={target.address}>
                      <span>
                        <strong>{target.label || "Allowed target"}</strong>
                        <small>Smart wallet policy</small>
                      </span>
                      <code title={target.address}>{formatAddress(target.address)}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4>Benchmark targets</h4>
              {benchmarkTargets.length === 0 ? (
                <p>
                  {activeBenchmark
                    ? "ABI-only benchmark; execution uses the wallet allowlist."
                    : "No active benchmark targets."}
                </p>
              ) : (
                <ul className="onchain-address-list">
                  {benchmarkTargets.slice(0, 8).map((target) => (
                    <li key={target}>
                      <span>
                        <strong>Benchmark target</strong>
                        <small>{activeBenchmark?.name}</small>
                      </span>
                      <code title={target}>{formatAddress(target)}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="onchain-report-section" aria-label="Executions and transaction timeline">
          <div className="console-topline">
            <span>Executions & txs</span>
            <span className="status-pill status-ready">
              {activityLoading ? "Scanning" : `${activity?.timeline?.length ?? 0} tx`}
            </span>
          </div>

          <dl className="benchmark-debug-grid onchain-report-grid">
            <div>
              <dt>Proofs recorded</dt>
              <dd>{isLoading ? "Loading..." : proofCount}</dd>
            </div>

            <div>
              <dt>Safe / blocked</dt>
              <dd>
                {isLoading
                  ? "Loading..."
                  : `${stats.safeActions} safe · ${stats.blockedActions} blocked`}
              </dd>
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
              <dt>Latest status</dt>
              <dd>
                {reportHealthy
                  ? latestValidation
                    ? "Identity, benchmark, executor, and latest validation are aligned"
                    : "Identity, benchmark, and executor are configured; first validation is pending"
                  : hasOnchainRecords
                    ? "Mantle records found, but setup/reporting needs attention"
                    : "No on-chain execution records yet"}
              </dd>
            </div>
          </dl>

          {activityError && <p className="error-text">{activityError}</p>}
          {activityLoading ? (
            <p>Scanning Mantle logs for setup, validation, reputation, and execution txs.</p>
          ) : !activity?.timeline?.length ? (
            <p>
              No setup, validation, reputation, or wallet execution transactions found in
              the indexed window.
            </p>
          ) : (
            <ol className="tool-trace-list onchain-transaction-list">
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
      </div>
    </section>
  );
}
