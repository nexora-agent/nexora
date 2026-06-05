"use client";

import type { AgentRecord, ObjectiveRun } from "@nexora/shared";
import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { getAgentPolicy, upsertCachedAgent } from "@/lib/agents/localAgentRegistry";
import {
  type BenchmarkScenario,
  benchmarkScenarios,
  runAiMntBenchmark,
} from "@/lib/benchmark/runAiMntBenchmark";
import { runLocalHarnessBenchmark } from "@/lib/harness/localHarnessRuntime";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { buildPreflightCredential } from "@/lib/preflight/buildPreflightCredential";
import { getPreflightThresholds } from "@/lib/preflight/preflightPolicy";
import { normalizeModelConfig } from "@/lib/smartWalletDefinition";

type BenchmarkTestLabProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onObjectiveRunSaved: (agent: AgentRecord) => void;
  onViewReports?: () => void;
};

export function BenchmarkTestLab({
  agent,
  isOwner,
  onObjectiveRunSaved,
  onViewReports,
}: BenchmarkTestLabProps) {
  const { address } = useWalletConnection();
  const [latestRun, setLatestRun] = useState<ObjectiveRun | undefined>(
    agent.objectiveRuns?.find((run) => run.intent?.kind === "mnt_vault_deposit") ??
      agent.objectiveRuns?.[0],
  );
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [suiteRuns, setSuiteRuns] = useState<ObjectiveRun[]>([]);
  const policy = getAgentPolicy(agent);
  const preflightThresholds = getPreflightThresholds(agent);
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const modelConfig = normalizeModelConfig(agent);
  const usesLocalHarness = Boolean(harness.localRuntimeUrl);
  const canRun = Boolean(agent.walletAddress && address && isOwner && !isRunning);

  const commitAgent = (updatedAgent: AgentRecord) => {
    upsertCachedAgent(updatedAgent);
    onObjectiveRunSaved(updatedAgent);
  };

  const thresholdForScenario = (scenarioId: BenchmarkScenario["id"]) => {
    if (scenarioId === "basic_safety") {
      return preflightThresholds.basicSafetyMinScore;
    }

    if (scenarioId === "adversarial_yield_trap") {
      return preflightThresholds.adversarialYieldTrapMinScore;
    }

    return preflightThresholds.externalDefiReadinessMinScore;
  };

  const runScenario = (scenario: BenchmarkScenario) =>
    usesLocalHarness
      ? runLocalHarnessBenchmark({ agent, harness, policy, scenario })
      : runAiMntBenchmark(agent, scenario);

  const saveSuiteRuns = (runs: ObjectiveRun[]) => {
    const actionRun =
      runs.find((run) => run.intent?.metadata?.benchmarkLevel === "external_defi_readiness") ??
      runs.at(-1);

    if (!actionRun) {
      throw new Error("Benchmark suite did not produce a result.");
    }

    const credential = buildPreflightCredential({
      actionRun,
      agent,
      policy,
      runs,
      thresholds: preflightThresholds,
    });
    const actionRunWithGate = {
      ...actionRun,
      preflight: credential,
    };
    const runsWithGate = runs.map((run) =>
      run.id === actionRunWithGate.id ? actionRunWithGate : run,
    );
    const existingRuns = agent.objectiveRuns ?? [];
    const runIds = new Set(runsWithGate.map((run) => run.id));
    const updatedAgent = {
      ...agent,
      objectiveRuns: [
        ...runsWithGate,
        ...existingRuns.filter((run) => !runIds.has(run.id)),
      ],
    };

    setSuiteRuns(runsWithGate);
    setLatestRun(actionRunWithGate);
    commitAgent(updatedAgent);

    return { actionRun: actionRunWithGate, credential, existingRuns, runIds, runsWithGate };
  };

  const runBenchmark = async () => {
    setError("");

    if (!agent.walletAddress) {
      setError("Create the smart wallet before running the benchmark.");
      return;
    }

    if (!address || !isOwner) {
      setError("Only the owner wallet can run the benchmark.");
      return;
    }

    setIsRunning(true);

    try {
      const runs: ObjectiveRun[] = [];
      for (const scenario of benchmarkScenarios) {
        runs.push(await runScenario(scenario));
      }
      saveSuiteRuns(runs);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not run benchmark.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const displayedSuiteRuns = suiteRuns.length
    ? suiteRuns
    : agent.objectiveRuns?.filter((run) => run.intent?.metadata?.benchmarkLevel) ?? [];
  const suiteAverage = displayedSuiteRuns.length
    ? Math.round(
        displayedSuiteRuns.reduce(
          (total, run) => total + (run.benchmarkScore?.finalScore ?? 0),
          0,
        ) / displayedSuiteRuns.length,
      )
    : undefined;
  const latestPreflight = latestRun?.preflight;
  const selectedVault = latestRun?.intent?.metadata?.targetVault ?? "Not tested";
  const scenarioResults = benchmarkScenarios.map((scenario) => {
    const run = displayedSuiteRuns.find(
      (candidate) => candidate.intent?.metadata?.benchmarkLevel === scenario.id,
    );
    const score = run?.benchmarkScore?.finalScore;
    const threshold = thresholdForScenario(scenario.id);

    return {
      id: scenario.id,
      name: scenario.name
        .replace("Safe MNT Yield Test", "Basic Safety")
        .replace("Adversarial Yield Trap Test", "Yield Trap")
        .replace("External DeFi Readiness Test", "External Readiness"),
      score,
      status: score === undefined ? "Not run" : score >= threshold ? "Passed" : "Below target",
      threshold,
    };
  });

  return (
    <section className="benchmark-lab-shell" aria-label="Wallet benchmark lab">
      <div className="benchmark-lab-hero">
        <div>
          <span className="status-pill status-current">Mantle Sepolia</span>
          <h3>AI Wallet Benchmark</h3>
          <p>
            Run the configured model through the benchmark suite and review the scores.
          </p>
          <span className="benchmark-model-label">
            {modelConfig.connectionType === "demo"
              ? usesLocalHarness
                ? `Local harness · ${harness.name}`
                : "Demo model fallback"
              : `${modelConfig.modelName} · ${modelConfig.connectionType}`}
          </span>
        </div>
        <button
          className="primary-action benchmark-run-button"
          disabled={!canRun}
          onClick={() => void runBenchmark()}
          type="button"
        >
          {isRunning ? "Testing..." : usesLocalHarness ? "Run Local Harness" : "Run Wallet Benchmark"}
        </button>
      </div>

      <section className="benchmark-suite-summary" aria-label="Benchmark scores">
        <div className="console-topline">
          <span>Benchmark Scores</span>
          <span className="status-pill status-current">
            Average {suiteAverage ?? "—"}
          </span>
        </div>
        <div className="suite-result-grid">
          {scenarioResults.map((result) => (
            <article key={result.id}>
              <strong>{result.name}</strong>
              <span>{result.score ?? "—"} / 100</span>
              <small>
                Target {result.threshold} · {result.status}
              </small>
            </article>
          ))}
        </div>
      </section>

      {latestRun && (
        <section className="benchmark-suite-summary" aria-label="Benchmark outcome">
          <div className="suite-result-grid">
            <article>
              <strong>Selected Vault</strong>
              <span>{selectedVault}</span>
              <small>Model-selected benchmark target</small>
            </article>
            <article>
              <strong>Risk Score</strong>
              <span>{latestRun.riskReport?.riskScore ?? "—"} / 100</span>
              <small>{latestRun.riskReport?.policyDecision ?? "Not tested"}</small>
            </article>
            <article>
              <strong>Result</strong>
              <span>{latestPreflight?.passed ? "Passed" : "Needs review"}</span>
              <small>
                {latestPreflight?.passed
                  ? "Benchmark passed configured thresholds"
                  : latestPreflight?.blockedReason ?? "Local benchmark result"}
              </small>
            </article>
          </div>
        </section>
      )}

      {!agent.walletAddress && (
        <p className="ownership-note">Create the smart wallet before running a benchmark.</p>
      )}
      {agent.walletAddress && !isOwner && (
        <p className="ownership-note">Only the owner wallet can run this benchmark.</p>
      )}
      {error && <p className="error-text">{error}</p>}
      {latestRun && onViewReports && (
        <button className="secondary-action" onClick={onViewReports} type="button">
          View Full Report
        </button>
      )}
    </section>
  );
}
