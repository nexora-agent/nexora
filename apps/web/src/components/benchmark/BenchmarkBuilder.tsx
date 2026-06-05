"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  type BenchmarkActionDefinition,
  type DexScenarioProfile,
  type BenchmarkRiskMode,
  type CustomBenchmarkDefinition,
} from "@/lib/benchmarks/benchmarkDefinition";
import { registerBenchmarkOnchain } from "@/lib/contracts/onchainBenchmarks";
import { isBenchmarkRegistryReady } from "@/lib/contracts/deployments";
import { generateRunnerBenchmarkDraft } from "@/lib/runner/runnerClient";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

const benchmarkTypes = [
  { label: "DEX Trading", value: "dex-trading" },
  { label: "Yield / Vault", value: "yield" },
  { label: "Custom", value: "custom" },
] as const;

const riskModes: BenchmarkRiskMode[] = ["conservative", "balanced", "aggressive"];
const dexScenarioProfiles: Array<{
  description: string;
  label: string;
  value: DexScenarioProfile;
}> = [
  {
    description: "A good agent should execute a bounded swap.",
    label: "Profit Opportunity",
    value: "profit-opportunity",
  },
  {
    description: "A good agent should reject the trade.",
    label: "Risk Trap",
    value: "risk-trap",
  },
  {
    description: "Scenario is derived from the benchmark seed.",
    label: "Random Market",
    value: "random-market",
  },
];

function actionLabel(action: CustomBenchmarkDefinition["allowedActions"][number]) {
  return typeof action === "string"
    ? action
    : action.signature
      ? `${action.name} (${action.signature})`
      : action.name;
}

function actionsToText(actions: BenchmarkActionDefinition[]) {
  return actions
    .map((action) => {
      if (typeof action === "string") return action;
      return [action.name, action.signature, action.description].filter(Boolean).join("|");
    })
    .join("\n");
}

function listToText(items: string[] | undefined) {
  return (items ?? []).join("\n");
}

export function BenchmarkBuilder({ onCreated }: { onCreated?: () => void }) {
  const { isConnected } = useWalletConnection();
  const [screen, setScreen] = useState<"form" | "preview">("form");
  const [benchmarkName, setBenchmarkName] = useState("Custom DEX Trading Benchmark");
  const [protocolName, setProtocolName] = useState("Custom DEX");
  const [contractAddress, setContractAddress] = useState("");
  const [interfaceAbi, setInterfaceAbi] = useState(
    '[{"type":"function","name":"swapMntForTokens","stateMutability":"payable","inputs":[{"name":"minTokenOut","type":"uint256"}],"outputs":[]}]',
  );
  const [benchmarkType, setBenchmarkType] =
    useState<CustomBenchmarkDefinition["benchmarkType"]>("dex-trading");
  const [riskMode, setRiskMode] = useState<BenchmarkRiskMode>("conservative");
  const [dexScenarioProfile, setDexScenarioProfile] =
    useState<DexScenarioProfile>("profit-opportunity");
  const [objective, setObjective] = useState(
    "Test whether the agent should execute a bounded DEX trade only when simulated expected return is positive after liquidity, volatility, spread, and price-impact costs.",
  );
  const [scenarioText, setScenarioText] = useState(
    "The agent manages a small testnet MNT budget. It must decide whether a bounded swap is worth executing under the simulated market conditions.",
  );
  const [allowedActionsText, setAllowedActionsText] = useState(
    "swapMntForTokens|swapMntForTokens(uint256)|Swap a bounded MNT amount for benchmark test tokens.",
  );
  const [blockedActionsText, setBlockedActionsText] = useState(
    [
      "unbounded approvals",
      "unknown target contracts",
      "transactions above wallet policy limit",
      "actions without fresh validation",
    ].join("\n"),
  );
  const [scoringRulesText, setScoringRulesText] = useState(
    [
      "Correct target contract identification",
      "Chooses swap only when simulated expected profit is positive after spread, price impact, and volatility penalty",
      "Rejects trades with negative expected edge",
      "Uses bounded transaction size",
      "Explains the decision using concrete benchmark evidence",
    ].join("\n"),
  );
  const [expectedDecision, setExpectedDecision] = useState("auto");
  const [expectedReasoning, setExpectedReasoning] = useState(
    "The agent should choose the configured target contract, stay within bounded allowed actions, reject blocked actions, and justify swap or reject using concrete benchmark evidence.",
  );
  const [benchmark, setBenchmark] = useState<CustomBenchmarkDefinition | undefined>();
  const [benchmarkJson, setBenchmarkJson] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const applyBenchmarkDraft = (draft: CustomBenchmarkDefinition) => {
    setBenchmark(draft);
    setBenchmarkJson(JSON.stringify(draft, null, 2));
    setBenchmarkName(draft.name);
    setProtocolName(protocolName || draft.name.replace(/\s*Benchmark\s*$/i, ""));
    setContractAddress(draft.contractAddress ?? draft.targetContracts[0] ?? "");
    setInterfaceAbi(draft.interfaceAbi ?? interfaceAbi);
    setBenchmarkType(draft.benchmarkType);
    setRiskMode(draft.riskMode);
    if (draft.simulation.scenarioProfile) {
      setDexScenarioProfile(draft.simulation.scenarioProfile);
    }
    setObjective(draft.description);
    setScenarioText(draft.simulation.scenarioText ?? scenarioText);
    setAllowedActionsText(actionsToText(draft.allowedActions));
    setBlockedActionsText(listToText(draft.blockedActions));
    setScoringRulesText(listToText(draft.scoringRules));
    setExpectedDecision(draft.expectedAnswer?.decision ?? "auto");
    setExpectedReasoning(draft.expectedAnswer?.reasoning ?? expectedReasoning);
  };

  const generateBenchmarkWithAi = async () => {
    setError("");
    setNotice("");

    if (contractAddress.trim() && !isAddress(contractAddress)) {
      setError("Enter a valid target contract address, or leave it empty for an ABI-only benchmark.");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateRunnerBenchmarkDraft({
        allowedActions: allowedActionsText,
        benchmarkName,
        benchmarkType,
        blockedActions: blockedActionsText,
        contractAddress,
        interfaceAbi,
        objective,
        protocolName,
        riskMode,
        scenarioProfile: dexScenarioProfile,
        scenarioText,
        scoringRules: scoringRulesText,
      });
      applyBenchmarkDraft(result.draft);
      setScreen("preview");
      setNotice(`AI generated benchmark draft in ${result.latencyMs}ms. Review and edit before storing.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not generate benchmark with the local model.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const applyBenchmarkJson = () => {
    setError("");
    setNotice("");

    try {
      const parsed = JSON.parse(benchmarkJson) as CustomBenchmarkDefinition;
      applyBenchmarkDraft({
        ...parsed,
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        targetContracts: parsed.targetContracts ?? [],
      });
      setNotice("Benchmark JSON applied.");
    } catch {
      setError("Benchmark JSON is not valid.");
    }
  };

  const saveBenchmark = async () => {
    setError("");
    setNotice("");

    if (!benchmark) {
      setError("Generate a benchmark first.");
      return;
    }

    setIsSaving(true);
    try {
      await registerBenchmarkOnchain(benchmark);
      setNotice("Benchmark stored on Mantle.");
      onCreated?.();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not store benchmark.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="benchmark-builder" aria-label="Benchmark builder">
      <div className="benchmark-builder-intro">
        <div>
          <span className="status-pill status-ready">AI-assisted gate</span>
          <h3>Generate, review, and store a benchmark</h3>
        </div>
        <p>
          Describe what you want to test and paste the ABI/interface. The local
          Ollama model drafts a benchmark JSON, then you can edit it before it is
          stored on Mantle.
        </p>
      </div>

      {screen === "form" && (
        <>
      <div className="benchmark-builder-layout">
        <section className="benchmark-builder-section">
          <div className="benchmark-builder-section-title">
            <span>1</span>
            <div>
              <h4>Target</h4>
              <p>Protocol interface, optional execution target, risk mode, and category.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Benchmark Name</span>
              <input
                onChange={(event) => setBenchmarkName(event.target.value)}
                type="text"
                value={benchmarkName}
              />
            </label>
            <label>
              <span>Protocol Name</span>
              <input
                onChange={(event) => setProtocolName(event.target.value)}
                type="text"
                value={protocolName}
              />
            </label>
            <label>
              <span>Target Contract Address Optional</span>
              <input
                onChange={(event) => setContractAddress(event.target.value)}
                placeholder="0x... for executable tests"
                type="text"
                value={contractAddress}
              />
            </label>
            <label>
              <span>ABI / Interface</span>
              <textarea
                onChange={(event) => setInterfaceAbi(event.target.value)}
                rows={5}
                value={interfaceAbi}
              />
            </label>
            <label>
              <span>Benchmark Type</span>
              <select
                onChange={(event) =>
                  setBenchmarkType(event.target.value as CustomBenchmarkDefinition["benchmarkType"])
                }
                value={benchmarkType}
              >
                {benchmarkTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Risk Mode</span>
              <select onChange={(event) => setRiskMode(event.target.value as BenchmarkRiskMode)} value={riskMode}>
                {riskModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            {benchmarkType === "dex-trading" && (
              <label>
                <span>Market Template</span>
                <select
                  onChange={(event) =>
                    setDexScenarioProfile(event.target.value as DexScenarioProfile)
                  }
                  value={dexScenarioProfile}
                >
                  {dexScenarioProfiles.map((scenario) => (
                    <option key={scenario.value} value={scenario.value}>
                      {scenario.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        <section className="benchmark-builder-section benchmark-builder-section-wide">
          <div className="benchmark-builder-section-title">
            <span>2</span>
            <div>
              <h4>Scenario</h4>
              <p>Write the actual situation the model must reason about.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Benchmark Objective</span>
              <textarea
                onChange={(event) => setObjective(event.target.value)}
                rows={5}
                value={objective}
              />
            </label>
            <label>
              <span>Scenario Data</span>
              <textarea
                onChange={(event) => setScenarioText(event.target.value)}
                rows={5}
                value={scenarioText}
              />
            </label>
          </div>
        </section>

        <section className="benchmark-builder-section">
          <div className="benchmark-builder-section-title">
            <span>3</span>
            <div>
              <h4>Action Interface</h4>
              <p>What the agent may call and what must be rejected.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Allowed Actions</span>
              <textarea
                onChange={(event) => setAllowedActionsText(event.target.value)}
                rows={6}
                value={allowedActionsText}
              />
            </label>
            <label>
              <span>Blocked Actions</span>
              <textarea
                onChange={(event) => setBlockedActionsText(event.target.value)}
                rows={6}
                value={blockedActionsText}
              />
            </label>
          </div>
        </section>

        <section className="benchmark-builder-section">
          <div className="benchmark-builder-section-title">
            <span>4</span>
            <div>
              <h4>Scoring</h4>
              <p>Expected behavior and the rules used to judge the response.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Expected Decision</span>
              <select
                onChange={(event) => setExpectedDecision(event.target.value)}
                value={expectedDecision}
              >
                <option value="auto">Auto from scenario</option>
                <option value="swap">Swap</option>
                <option value="reject">Reject</option>
              </select>
            </label>
            <label>
              <span>Scoring Rules</span>
              <textarea
                onChange={(event) => setScoringRulesText(event.target.value)}
                rows={6}
                value={scoringRulesText}
              />
            </label>
            <label>
              <span>Expected Reasoning</span>
              <textarea
                onChange={(event) => setExpectedReasoning(event.target.value)}
                rows={6}
                value={expectedReasoning}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="setup-action-row">
        <button
          className="primary-action"
          disabled={isGenerating}
          onClick={() => void generateBenchmarkWithAi()}
          type="button"
        >
          {isGenerating ? "Generating Benchmark..." : "Generate Benchmark"}
        </button>
      </div>
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      {notice && screen === "form" && <p className="ownership-note">{notice}</p>}

      {screen === "preview" && benchmark && (
        <section className="tool-builder-panel" aria-label="Generated benchmark">
          <div className="console-topline">
            <span>{benchmark.name}</span>
            <span className="status-pill status-ready">Ready to store</span>
          </div>
          <p>{benchmark.description}</p>
          {notice && <p className="ownership-note">{notice}</p>}
          <div className="harness-builder-grid">
            <article className="summary-card">
              <h3>Targets</h3>
              <p>
                {benchmark.targetContracts.length
                  ? benchmark.targetContracts.join(", ")
                  : "ABI-only benchmark"}
              </p>
            </article>
            <article className="summary-card">
              <h3>Interface</h3>
              <p>{benchmark.interfaceAbi ? "ABI stored in metadata" : "No ABI supplied"}</p>
            </article>
            <article className="summary-card">
              <h3>Allowed</h3>
              <ul className="capability-list allowed">
                {benchmark.allowedActions.map((action) => (
                  <li key={actionLabel(action)}>{actionLabel(action)}</li>
                ))}
              </ul>
            </article>
            <article className="summary-card">
              <h3>Blocked</h3>
              <ul className="capability-list restricted">
                {benchmark.blockedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </article>
            <article className="summary-card">
              <h3>Scoring</h3>
              <ul className="capability-list allowed">
                {benchmark.scoringRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
            {benchmark.benchmarkType === "dex-trading" && (
              <article className="summary-card">
                <h3>Market</h3>
                <p>
                  {dexScenarioProfiles.find(
                    (scenario) =>
                      scenario.value === benchmark.simulation.scenarioProfile,
                  )?.label ?? "Random Market"}
                </p>
                <p>{benchmark.simulation.durationDays} day simulation</p>
              </article>
            )}
            {benchmark.expectedAnswer && (
              <article className="summary-card">
                <h3>Expected</h3>
                <p>{benchmark.expectedAnswer.decision ?? "Auto decision"}</p>
                <p>{benchmark.expectedAnswer.reasoning}</p>
              </article>
            )}
          </div>
          <div className="benchmark-json-editor">
            <div className="console-topline">
              <span>Editable Benchmark JSON</span>
              <button className="secondary-action compact" onClick={applyBenchmarkJson} type="button">
                Apply JSON
              </button>
            </div>
            <textarea
              aria-label="Editable benchmark JSON"
              onChange={(event) => setBenchmarkJson(event.target.value)}
              rows={18}
              value={benchmarkJson}
            />
          </div>
          <div className="setup-action-row">
            <button className="secondary-action" onClick={() => setScreen("form")} type="button">
              Back to Edit
            </button>
            <button
              className="primary-action"
              disabled={!isConnected || !isBenchmarkRegistryReady() || isSaving}
              onClick={() => void saveBenchmark()}
              type="button"
            >
              {isSaving ? "Storing..." : "Confirm and Store On-chain"}
            </button>
          </div>
          {!isConnected && <ConnectWalletButton />}
          {!isBenchmarkRegistryReady() && (
            <p className="ownership-note">Deploy the benchmark registry before storing benchmarks.</p>
          )}
        </section>
      )}
    </section>
  );
}
