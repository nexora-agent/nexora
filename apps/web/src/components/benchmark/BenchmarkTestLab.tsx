"use client";

import type { AgentRecord, ObjectiveRun } from "@nexora/shared";
import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { getAgentPolicy } from "@/lib/agents/localAgentRegistry";
import { runAiMntBenchmark } from "@/lib/benchmark/runAiMntBenchmark";
import { runLocalHarnessBenchmark } from "@/lib/harness/localHarnessRuntime";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
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
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const policy = getAgentPolicy(agent);
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const modelConfig = normalizeModelConfig(agent);
  const usesLocalHarness = Boolean(harness.localRuntimeUrl);
  const canRun = Boolean(agent.walletAddress && address && isOwner && !isRunning);

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
        ? await runLocalHarnessBenchmark({ agent, harness, policy })
        : await runAiMntBenchmark(agent);
      const updatedAgent = agentWithRun(agent, run);
      setLatestRun(run);
      onObjectiveRunSaved(updatedAgent);
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

  const updateObjectiveRun = (run: ObjectiveRun) => {
    const updatedAgent = agentWithRun(agent, run);
    setLatestRun(run);
    onObjectiveRunSaved(updatedAgent);
  };

  const score = latestRun?.benchmarkScore?.finalScore;
  const selectedVault = latestRun?.intent?.metadata?.targetVault ?? "Not tested";
  const rejectedVaults = latestRun?.intent?.metadata?.rejectedOptions
    ?.map((vault) => vault.name)
    .join(", ");
  const status = resultLabel(latestRun);

  return (
    <section className="benchmark-lab-shell" aria-label="Wallet benchmark lab">
      <div className="benchmark-lab-hero">
        <div>
          <span className="status-pill status-current">Mantle Sepolia</span>
          <h3>AI Wallet Benchmark</h3>
          <p>
            Challenge the configured model to choose a safe MNT strategy from risk-weighted vaults.
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
          {isRunning ? "Testing..." : usesLocalHarness ? "Run Local Harness" : "Run AI Benchmark"}
        </button>
      </div>

      {!agent.walletAddress && (
        <p className="ownership-note">Create the smart wallet before running a benchmark.</p>
      )}
      {agent.walletAddress && !isOwner && (
        <p className="ownership-note">Only the owner wallet can run this benchmark.</p>
      )}
      {error && <p className="error-text">{error}</p>}

      <div className="benchmark-check-grid" aria-label="Benchmark checks">
        <article>
          <strong>Safe vault choice</strong>
          <span>Choose safety over deceptive yield.</span>
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
