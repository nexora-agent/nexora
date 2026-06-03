"use client";

import type { ObjectiveRun } from "@nexora/shared";

type Props = {
  run: ObjectiveRun;
};

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" | "neutral" }) {
  const cls =
    highlight === "good"
      ? "status-ready"
      : highlight === "bad"
        ? "status-blocked"
        : "";
  return (
    <div>
      <dt>{label}</dt>
      <dd className={cls ? `status-pill ${cls}` : undefined}>{value}</dd>
    </div>
  );
}

export function DexBenchmarkReport({ run }: Props) {
  const meta = run.intent?.metadata;
  if (!meta?.dexScenario) return null;

  const decision = meta.dexDecision ?? "reject";
  const correct = meta.dexCorrectDecision ?? "reject";
  const isCorrect = decision === correct;
  const impactPct = meta.dexPriceImpactBps != null
    ? (meta.dexPriceImpactBps / 100).toFixed(2)
    : "—";
  const slippagePct = meta.dexSlippageBps != null
    ? (meta.dexSlippageBps / 100).toFixed(2)
    : "—";
  const pnl = Number(meta.dexSimulatedPnlMnt ?? "0");
  const pnlLabel = decision === "reject"
    ? "0.000000 MNT (capital preserved)"
    : `${meta.dexSimulatedPnlMnt ?? "0"} MNT`;

  const warnings = meta.modelGraderWarnings ?? [];

  return (
    <section className="summary-card dex-benchmark-report" aria-label="DEX benchmark report">
      <div className="card-heading-row">
        <h3>DEX Trading Benchmark</h3>
        <span className={`status-pill ${isCorrect ? "status-ready" : "status-blocked"}`}>
          {isCorrect ? "Correct decision" : "Incorrect decision"}
        </span>
      </div>

      <dl>
        <MetricRow label="Scenario" value={meta.dexScenarioLabel ?? meta.dexScenario} />
        <MetricRow label="Decision" value={decision.toUpperCase()} highlight={isCorrect ? "good" : "bad"} />
        <MetricRow label="Expected decision" value={correct.toUpperCase()} />
        <MetricRow
          label="Price impact"
          value={`${meta.dexPriceImpactBps ?? "—"} bps (${impactPct}%)`}
          highlight={meta.dexPriceImpactBps != null && meta.dexPriceImpactBps > 300 ? "bad" : "neutral"}
        />
        <MetricRow
          label="Slippage"
          value={`${meta.dexSlippageBps ?? "—"} bps (${slippagePct}%)`}
          highlight={meta.dexSlippageBps != null && meta.dexSlippageBps > 300 ? "bad" : "neutral"}
        />
        <MetricRow
          label="Liquidity"
          value={meta.dexLiquidityLabel ?? "—"}
          highlight={meta.dexLiquidityLabel === "empty" || meta.dexLiquidityLabel === "thin" ? "bad" : "neutral"}
        />
        <MetricRow label="MNT reserve" value={`${meta.dexMntReserve ?? "—"} MNT`} />
        <MetricRow label="Token reserve" value={`${meta.dexTokenReserve ?? "—"} NBT`} />
        <MetricRow label="Spot price" value={`${meta.dexSpotPrice ?? "—"} MNT/NBT`} />
        <MetricRow label="Expected out" value={`${meta.dexExpectedTokenOut ?? "—"} NBT`} />
        <MetricRow label="Min out (set by agent)" value={meta.dexMinOut ?? "—"} />
        <MetricRow
          label="Simulated PnL"
          value={pnlLabel}
          highlight={decision === "reject" ? "neutral" : pnl >= 0 ? "good" : "bad"}
        />
        <MetricRow label="Benchmark score" value={`${run.benchmarkScore?.finalScore ?? "—"} / 100`} />
        <MetricRow label="Risk score" value={`${run.riskReport?.riskScore ?? "—"} / 100`} />
      </dl>

      {meta.dexRiskChecks && (
        <section aria-label="Agent risk checks">
          <h4>Agent risk checks</h4>
          <dl>
            <MetricRow label="Slippage check" value={meta.dexRiskChecks.slippage} />
            <MetricRow label="Price impact check" value={meta.dexRiskChecks.priceImpact} />
            <MetricRow label="Liquidity check" value={meta.dexRiskChecks.liquidity} />
            <MetricRow label="Volatility check" value={meta.dexRiskChecks.volatility} />
          </dl>
        </section>
      )}

      {warnings.length > 0 && (
        <section aria-label="Grader warnings">
          <h4>Grader warnings ({warnings.length})</h4>
          <ul className="tool-trace-list">
            {warnings.map((w, i) => (
              <li key={i}>
                <span className="status-pill status-blocked">⚠</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {run.intent?.summary && (
        <p className="dex-intent-summary">{run.intent.summary}</p>
      )}
    </section>
  );
}
