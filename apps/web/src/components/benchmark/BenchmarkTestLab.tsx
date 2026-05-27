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
import {
  executeRunWithPreflightOnchain,
  recordPreflightOnchain,
} from "@/lib/contracts/onchainPreflight";
import { runLocalHarnessBenchmark } from "@/lib/harness/localHarnessRuntime";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { buildPreflightCredential } from "@/lib/preflight/buildPreflightCredential";
import { getPreflightThresholds } from "@/lib/preflight/preflightPolicy";
import { normalizeModelConfig } from "@/lib/smartWalletDefinition";
import { ObjectiveResultCard } from "../objective/ObjectiveResultCard";

type BenchmarkTestLabProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onObjectiveRunSaved: (agent: AgentRecord) => void;
  onViewReports?: () => void;
};

function shortHash(hash?: `0x${string}`) {
  if (!hash) {
    return "Not generated";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function resultLabel(run?: ObjectiveRun) {
  if (!run?.riskReport || !run.benchmarkScore) {
    return "Not tested";
  }

  if (run.riskReport.policyDecision === "passed" && run.benchmarkScore.finalScore >= 80) {
    return "Passed";
  }

  return "Needs review";
}

function permissionLabel(run?: ObjectiveRun) {
  if (!run?.benchmarkScore || !run.riskReport) {
    return "Run a benchmark";
  }

  if (run.riskReport.policyDecision !== "passed") {
    return "Locked";
  }

  if (
    run.intent?.metadata?.benchmarkUnlock === "external_defi_dry_run" &&
    run.benchmarkScore.finalScore >= 85
  ) {
    return "External DeFi Preview unlocked";
  }

  if (run.benchmarkScore.finalScore >= 75) {
    return "Benchmark complete";
  }

  return "Needs stronger score";
}

function agentWithRun(agent: AgentRecord, run: ObjectiveRun): AgentRecord {
  const existingRuns = agent.objectiveRuns ?? [];
  const hasRun = existingRuns.some((candidate) => candidate.id === run.id);

  return {
    ...agent,
    objectiveRuns: hasRun
      ? existingRuns.map((candidate) => candidate.id === run.id ? run : candidate)
      : [run, ...existingRuns],
  };
}

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
  const [selectedScenarioId, setSelectedScenarioId] = useState<BenchmarkScenario["id"]>(
    "basic_safety",
  );
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [suiteRuns, setSuiteRuns] = useState<ObjectiveRun[]>([]);
  const [preflightStatus, setPreflightStatus] = useState<
    "idle" | "running" | "blocked" | "publishing" | "executing" | "executed"
  >("idle");
  const policy = getAgentPolicy(agent);
  const preflightThresholds = getPreflightThresholds(agent);
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const modelConfig = normalizeModelConfig(agent);
  const usesLocalHarness = Boolean(harness.localRuntimeUrl);
  const canRun = Boolean(agent.walletAddress && address && isOwner && !isRunning && !isRunningSuite);
  const selectedScenario =
    benchmarkScenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    benchmarkScenarios[0];

  const commitAgent = (updatedAgent: AgentRecord) => {
    upsertCachedAgent(updatedAgent);
    onObjectiveRunSaved(updatedAgent);
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
      const run = usesLocalHarness
        ? await runLocalHarnessBenchmark({ agent, harness, policy, scenario: selectedScenario })
        : await runAiMntBenchmark(agent, selectedScenario);
      const updatedAgent = agentWithRun(agent, run);
      setLatestRun(run);
      commitAgent(updatedAgent);
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

  const runScenario = (scenario: BenchmarkScenario) =>
    usesLocalHarness
      ? runLocalHarnessBenchmark({ agent, harness, policy, scenario })
      : runAiMntBenchmark(agent, scenario);

  const runPreflightAndExecute = async () => {
    setError("");
    setPreflightStatus("running");

    if (!agent.walletAddress) {
      setError("Create the smart wallet before running preflight.");
      setPreflightStatus("idle");
      return;
    }

    if (!address || !isOwner) {
      setError("Only the owner wallet can run preflight.");
      setPreflightStatus("idle");
      return;
    }

    setIsRunningSuite(true);

    try {
      const runs: ObjectiveRun[] = [];
      for (const scenario of benchmarkScenarios) {
        runs.push(await runScenario(scenario));
      }
      const actionRun =
        runs.find((run) => run.intent?.metadata?.benchmarkLevel === "external_defi_readiness") ??
        runs.at(-1);

      if (!actionRun) {
        throw new Error("Preflight did not produce an executable action.");
      }

      let credential = buildPreflightCredential({
        actionRun,
        agent,
        policy,
        runs,
        thresholds: preflightThresholds,
      });
      let updatedActionRun: ObjectiveRun = {
        ...actionRun,
        preflight: credential,
      };

      const existingRuns = agent.objectiveRuns ?? [];
      const runIds = new Set(runs.map((run) => run.id));
      const suiteWithPreflight = runs.map((run) =>
        run.id === updatedActionRun.id ? updatedActionRun : run,
      );
      const updatedAgent = {
        ...agent,
        objectiveRuns: [
          ...suiteWithPreflight,
          ...existingRuns.filter((run) => !runIds.has(run.id)),
        ],
      };

      setSuiteRuns(suiteWithPreflight);
      setLatestRun(updatedActionRun);
      commitAgent(updatedAgent);

      if (!credential.passed) {
        setPreflightStatus("blocked");
        setError(credential.blockedReason ?? "Execution blocked by preflight thresholds.");
        return;
      }

      setPreflightStatus("publishing");
      const preflightTransactionHash = await recordPreflightOnchain(credential);
      credential = {
        ...credential,
        preflightTransactionHash,
      };
      updatedActionRun = {
        ...updatedActionRun,
        preflight: credential,
      };

      setPreflightStatus("executing");
      const executionTransactionHash = await executeRunWithPreflightOnchain(
        agent,
        updatedActionRun,
        credential,
      );
      const executedRun: ObjectiveRun = {
        ...updatedActionRun,
        execution: {
          createdAt: new Date().toISOString(),
          id: `execution-${updatedActionRun.id}`,
          intentHash: credential.actionIntentHash,
          objectiveRunId: updatedActionRun.id,
          reason: "Fresh preflight proof passed; Mantle transaction executed.",
          status: "executed",
          transactionHash: executionTransactionHash,
        },
        preflight: {
          ...credential,
          executionTransactionHash,
        },
      };
      const finalSuiteRuns = runs.map((run) =>
        run.id === executedRun.id ? executedRun : run,
      );
      setSuiteRuns(finalSuiteRuns);
      setLatestRun(executedRun);
      commitAgent({
        ...agent,
        objectiveRuns: [
          ...finalSuiteRuns,
          ...existingRuns.filter((run) => !runIds.has(run.id)),
        ],
      });
      setPreflightStatus("executed");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not run preflight.",
      );
      if (preflightStatus !== "blocked") {
        setPreflightStatus("idle");
      }
    } finally {
      setIsRunningSuite(false);
    }
  };

  const updateObjectiveRun = (run: ObjectiveRun) => {
    const updatedAgent = agentWithRun(agent, run);
    setLatestRun(run);
    commitAgent(updatedAgent);
  };

  const updateSuiteRun = (run: ObjectiveRun) => {
    setSuiteRuns((currentRuns) =>
      currentRuns.map((candidate) => candidate.id === run.id ? run : candidate),
    );
    updateObjectiveRun(run);
  };

  const score = latestRun?.benchmarkScore?.finalScore;
  const selectedVault = latestRun?.intent?.metadata?.targetVault ?? "Not tested";
  const rejectedVaults = latestRun?.intent?.metadata?.rejectedOptions
    ?.map((vault) => vault.name)
    .join(", ");
  const status = resultLabel(latestRun);
  const permission = permissionLabel(latestRun);
  const displayedSuiteRuns = suiteRuns.length
    ? suiteRuns
    : [];
  const suiteAverage = displayedSuiteRuns.length
    ? Math.round(
        displayedSuiteRuns.reduce(
          (total, run) => total + (run.benchmarkScore?.finalScore ?? 0),
          0,
        ) / displayedSuiteRuns.length,
      )
    : undefined;
  const latestPreflight = latestRun?.preflight;
  const preflightStatusLabel =
    preflightStatus === "idle" && latestPreflight
      ? latestPreflight.executionTransactionHash
        ? "Executed"
        : latestPreflight.passed
          ? "Ready to publish"
          : "Blocked"
      : preflightStatus === "running"
        ? "Running benchmarks"
        : preflightStatus === "publishing"
          ? "Publishing proof"
          : preflightStatus === "executing"
            ? "Executing transaction"
            : preflightStatus === "executed"
              ? "Executed"
              : "Not run";

  return (
    <section className="benchmark-lab-shell" aria-label="Wallet benchmark lab">
      <div className="benchmark-lab-hero">
        <div>
          <span className="status-pill status-current">Mantle Sepolia</span>
          <h3>AI Wallet Benchmark</h3>
          <p>
            Challenge the configured model with fresh MNT safety tests before a Mantle transaction can execute.
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
        <button
          className="secondary-action benchmark-run-button"
          disabled={!canRun}
          onClick={() => void runPreflightAndExecute()}
          type="button"
        >
          {isRunningSuite ? "Running Preflight..." : "Run Preflight & Execute"}
        </button>
      </div>

      <div className="benchmark-scenario-grid" aria-label="Benchmark levels">
        {benchmarkScenarios.map((scenario) => (
          <button
            aria-pressed={selectedScenario.id === scenario.id}
            className={selectedScenario.id === scenario.id ? "scenario-card active" : "scenario-card"}
            key={scenario.id}
            onClick={() => setSelectedScenarioId(scenario.id)}
            type="button"
          >
            <strong>{scenario.name}</strong>
            <span>{scenario.summary}</span>
            <small>
              {scenario.unlock === "external_defi_dry_run"
                ? "External DeFi Preview readiness"
                : "Benchmark score"}
            </small>
          </button>
        ))}
      </div>

      <section className="benchmark-suite-summary" aria-label="Preflight execution gate">
        <div className="console-topline">
          <span>Preflight Execution Gate</span>
          <span className={`status-pill ${latestPreflight?.passed ? "status-ready" : "status-current"}`}>
            {preflightStatusLabel}
          </span>
        </div>
        <div className="suite-result-grid">
          <article>
            <strong>Proposed Action</strong>
            <span>{latestRun?.intent?.summary ?? "0.01 MNT deposit into the selected safe vault"}</span>
            <small>{latestRun?.intent?.kind ?? "mnt_vault_deposit"}</small>
          </article>
          <article>
            <strong>Required Benchmarks</strong>
            <span>Basic Safety, Adversarial Yield Trap, External DeFi Readiness</span>
            <small>Same model, harness, tools, and policy</small>
          </article>
          <article>
            <strong>Thresholds</strong>
            <span>
              {preflightThresholds.basicSafetyMinScore} / {preflightThresholds.adversarialYieldTrapMinScore} / {preflightThresholds.externalDefiReadinessMinScore}
            </span>
            <small>Max risk {preflightThresholds.maxRiskScore}; fresh {preflightThresholds.freshnessMinutes} min</small>
          </article>
          <article>
            <strong>Preflight Result</strong>
            <span>{latestPreflight?.passed ? "Passed" : latestPreflight?.blockedReason ?? "Not run"}</span>
            <small>
              Average {latestPreflight?.averageScore ?? "—"} · risk {latestPreflight?.highestRiskScore ?? "—"}
            </small>
          </article>
        </div>
        {latestPreflight && (
          <dl className="preflight-proof-list">
            <div>
              <dt>Action Intent</dt>
              <dd>{shortHash(latestPreflight.actionIntentHash)}</dd>
            </div>
            <div>
              <dt>Suite Hash</dt>
              <dd>{shortHash(latestPreflight.suiteHash)}</dd>
            </div>
            <div>
              <dt>Publish</dt>
              <dd>{shortHash(latestPreflight.preflightTransactionHash)}</dd>
            </div>
            <div>
              <dt>Execute</dt>
              <dd>{shortHash(latestPreflight.executionTransactionHash)}</dd>
            </div>
          </dl>
        )}
      </section>

      {!agent.walletAddress && (
        <p className="ownership-note">Create the smart wallet before running a benchmark.</p>
      )}
      {agent.walletAddress && !isOwner && (
        <p className="ownership-note">Only the owner wallet can run this benchmark.</p>
      )}
      {error && <p className="error-text">{error}</p>}

      <div className="benchmark-check-grid" aria-label="Benchmark checks">
        <article>
          <strong>{selectedScenario.name}</strong>
          <span>{selectedScenario.summary}</span>
        </article>
        <article>
          <strong>Risk rejection</strong>
          <span>Reject low-liquidity and volatile traps.</span>
        </article>
        <article>
          <strong>Model quality</strong>
          <span>Score the actual model decision.</span>
        </article>
      </div>

      <section className="benchmark-result-summary" aria-label="Benchmark result">
        <div className="benchmark-score-orb">
          <span>{score ?? "—"}</span>
          <small>Score</small>
        </div>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Permission</dt>
            <dd>{permission}</dd>
          </div>
          <div>
            <dt>Benchmark</dt>
            <dd>{latestRun?.intent?.metadata?.benchmarkName ?? selectedScenario.name}</dd>
          </div>
          <div>
            <dt>Selected Vault</dt>
            <dd>{selectedVault}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{latestRun?.intent?.metadata?.modelName ?? modelConfig.modelName}</dd>
          </div>
          <div>
            <dt>Risk Score</dt>
            <dd>{latestRun?.riskReport ? `${latestRun.riskReport.riskScore} / 100` : "Not tested"}</dd>
          </div>
          <div>
            <dt>Rejected</dt>
            <dd>{rejectedVaults || "Not tested"}</dd>
          </div>
          <div>
            <dt>Report Hash</dt>
            <dd>{shortHash(latestRun?.reportEnvelope?.reportHash)}</dd>
          </div>
        </dl>
        {latestRun && onViewReports && (
          <button className="secondary-action" onClick={onViewReports} type="button">
            View Reports
          </button>
        )}
      </section>

      {displayedSuiteRuns.length > 0 && (
        <section className="benchmark-suite-summary" aria-label="Benchmark suite summary">
          <div className="console-topline">
            <span>Benchmark Suite</span>
            <span className="status-pill status-ready">
              Average {suiteAverage ?? "—"}
            </span>
          </div>
          <div className="suite-result-grid">
            {benchmarkScenarios.map((scenario) => {
              const run = displayedSuiteRuns.find(
                (candidate) => candidate.intent?.metadata?.benchmarkLevel === scenario.id,
              );

              return (
                <article key={scenario.id}>
                  <strong>{scenario.name}</strong>
                  <span>{run?.benchmarkScore?.finalScore ?? "—"} score</span>
                  <small>{run?.riskReport?.policyDecision ?? "not run"}</small>
                </article>
              );
            })}
          </div>
          <p>
            Each suite result contributes to the preflight proof. Passing preflight publishes a credential to Mantle before execution.
          </p>
          <details className="benchmark-technical-details">
            <summary>Suite on-chain reports</summary>
            {displayedSuiteRuns.map((run) => (
              <ObjectiveResultCard
                agent={agent}
                key={run.id}
                policy={policy}
                run={run}
                onRunUpdated={updateSuiteRun}
              />
            ))}
          </details>
        </section>
      )}

      {latestRun && (
        <details className="benchmark-technical-details">
          <summary>Technical report</summary>
          <ObjectiveResultCard
            agent={agent}
            policy={policy}
            run={latestRun}
            onRunUpdated={updateObjectiveRun}
          />
        </details>
      )}
    </section>
  );
}
