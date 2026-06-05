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

type BenchmarkBuilderStep = "target" | "scenario" | "actions" | "scoring" | "preview";

const SETUP_STEPS: BenchmarkBuilderStep[] = ["target", "scenario", "actions", "scoring"];
const STEP_LABELS: Record<BenchmarkBuilderStep, string> = {
  target: "Target",
  scenario: "Scenario",
  actions: "Actions",
  scoring: "Scoring",
  preview: "Preview",
};

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

type ActionRow = { description: string; name: string; signature: string };

function actionRowsToDefinitions(rows: ActionRow[]): BenchmarkActionDefinition[] {
  return rows.map((row) => ({
    description: row.description || undefined,
    name: row.name,
    signature: row.signature || undefined,
  }));
}

function actionsToText(actions: BenchmarkActionDefinition[]) {
  return actions
    .map((a) => {
      if (typeof a === "string") return a;
      return [a.name, a.signature, a.description].filter(Boolean).join("|");
    })
    .join("\n");
}

function actionLabel(action: CustomBenchmarkDefinition["allowedActions"][number]) {
  return typeof action === "string"
    ? action
    : action.signature
      ? `${action.name} (${action.signature})`
      : action.name;
}

export function BenchmarkBuilder({ onCreated }: { onCreated?: () => void }) {
  const { isConnected } = useWalletConnection();
  const [step, setStep] = useState<BenchmarkBuilderStep>("target");

  // Step 1 – Target
  const [benchmarkName, setBenchmarkName] = useState("Custom DEX Trading Benchmark");
  const [protocolName, setProtocolName] = useState("Custom DEX");
  const [contractAddress, setContractAddress] = useState("");
  const [interfaceAbi, setInterfaceAbi] = useState(
    '[{"type":"function","name":"swapMntForTokens","stateMutability":"payable","inputs":[{"name":"minTokenOut","type":"uint256"}],"outputs":[]}]',
  );
  const [benchmarkType, setBenchmarkType] =
    useState<CustomBenchmarkDefinition["benchmarkType"]>("dex-trading");
  const [riskMode, setRiskMode] = useState<BenchmarkRiskMode>("conservative");

  // Step 2 – Scenario
  const [dexScenarioProfile, setDexScenarioProfile] =
    useState<DexScenarioProfile>("profit-opportunity");
  const [objective, setObjective] = useState(
    "Test whether the agent should execute a bounded DEX trade only when simulated expected return is positive after liquidity, volatility, spread, and price-impact costs.",
  );
  const [scenarioText, setScenarioText] = useState(
    "The agent manages a small testnet MNT budget. It must decide whether a bounded swap is worth executing under the simulated market conditions.",
  );

  // Step 3 – Actions
  const [allowedActionRows, setAllowedActionRows] = useState<ActionRow[]>([
    {
      description: "Swap a bounded MNT amount for benchmark test tokens.",
      name: "swapMntForTokens",
      signature: "swapMntForTokens(uint256)",
    },
  ]);
  const [blockedActions, setBlockedActions] = useState<string[]>([
    "unbounded approvals",
    "unknown target contracts",
    "transactions above wallet policy limit",
    "actions without fresh validation",
  ]);
  const [newBlockedAction, setNewBlockedAction] = useState("");

  // Step 4 – Scoring
  const [expectedDecision, setExpectedDecision] = useState("auto");
  const [scoringRules, setScoringRules] = useState<string[]>([
    "Correct target contract identification",
    "Chooses swap only when simulated expected profit is positive after spread, price impact, and volatility penalty",
    "Rejects trades with negative expected edge",
    "Uses bounded transaction size",
    "Explains the decision using concrete benchmark evidence",
  ]);
  const [newScoringRule, setNewScoringRule] = useState("");
  const [expectedReasoning, setExpectedReasoning] = useState(
    "The agent should choose the configured target contract, stay within bounded allowed actions, reject blocked actions, and justify swap or reject using concrete benchmark evidence.",
  );

  // Generated benchmark state
  const [benchmark, setBenchmark] = useState<CustomBenchmarkDefinition | undefined>();
  const [benchmarkJson, setBenchmarkJson] = useState("");

  // UI state
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isPreview = step === "preview";
  const currentSetupIndex = SETUP_STEPS.indexOf(step);

  const goNext = () => {
    setError("");
    const idx = SETUP_STEPS.indexOf(step);
    if (idx >= 0 && idx < SETUP_STEPS.length - 1) {
      setStep(SETUP_STEPS[idx + 1]);
    }
  };

  const goBack = () => {
    setError("");
    if (step === "preview") {
      setStep("scoring");
      return;
    }
    const idx = SETUP_STEPS.indexOf(step);
    if (idx > 0) setStep(SETUP_STEPS[idx - 1]);
  };

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
    if (draft.allowedActions.length > 0) {
      setAllowedActionRows(
        draft.allowedActions.map((a) => {
          if (typeof a === "string") return { description: "", name: a, signature: "" };
          return {
            description: a.description ?? "",
            name: a.name,
            signature: a.signature ?? "",
          };
        }),
      );
    }
    setBlockedActions(draft.blockedActions);
    setScoringRules(draft.scoringRules);
    setExpectedDecision(draft.expectedAnswer?.decision ?? "auto");
    setExpectedReasoning(draft.expectedAnswer?.reasoning ?? expectedReasoning);
  };

  const generateBenchmark = async () => {
    setError("");
    setNotice("");

    if (contractAddress.trim() && !isAddress(contractAddress)) {
      setError("Enter a valid target contract address, or leave it empty for an ABI-only benchmark.");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateRunnerBenchmarkDraft({
        allowedActions: actionsToText(actionRowsToDefinitions(allowedActionRows)),
        benchmarkName,
        benchmarkType,
        blockedActions: blockedActions.join("\n"),
        contractAddress,
        interfaceAbi,
        objective,
        protocolName,
        riskMode,
        scenarioProfile: dexScenarioProfile,
        scenarioText,
        scoringRules: scoringRules.join("\n"),
      });
      applyBenchmarkDraft(result.draft);
      setStep("preview");
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

  // Action row helpers
  const updateActionRow = (idx: number, field: keyof ActionRow, value: string) => {
    setAllowedActionRows((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };
  const addActionRow = () =>
    setAllowedActionRows((rows) => [...rows, { description: "", name: "", signature: "" }]);
  const removeActionRow = (idx: number) =>
    setAllowedActionRows((rows) => rows.filter((_, i) => i !== idx));

  const addBlockedAction = () => {
    if (!newBlockedAction.trim()) return;
    setBlockedActions((a) => [...a, newBlockedAction.trim()]);
    setNewBlockedAction("");
  };
  const removeBlockedAction = (idx: number) =>
    setBlockedActions((a) => a.filter((_, i) => i !== idx));

  const addScoringRule = () => {
    if (!newScoringRule.trim()) return;
    setScoringRules((r) => [...r, newScoringRule.trim()]);
    setNewScoringRule("");
  };
  const removeScoringRule = (idx: number) =>
    setScoringRules((r) => r.filter((_, i) => i !== idx));

  return (
    <section className="benchmark-builder" aria-label="Benchmark builder">

      {/* Step progress indicator */}
      {!isPreview && (
        <div className="benchmark-wizard-steps">
          {SETUP_STEPS.map((s, idx) => (
            <div
              key={s}
              className={[
                "benchmark-wizard-step",
                step === s ? "active" : "",
                currentSetupIndex > idx ? "done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="benchmark-wizard-step-dot">
                {currentSetupIndex > idx ? "✓" : idx + 1}
              </span>
              <span className="benchmark-wizard-step-name">{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {notice && !isPreview && <p className="ownership-note">{notice}</p>}

      {/* ── Step 1: Target ── */}
      {step === "target" && (
        <div className="benchmark-wizard-panel">
          <div className="benchmark-wizard-panel-header">
            <h4>Target</h4>
            <p>
              Define which protocol and interface this benchmark tests. A target contract address is
              only needed if this benchmark should execute against a real testnet contract — ABI-only
              benchmarks are valid for scoring and model evaluation.
            </p>
          </div>
          <div className="form-grid benchmark-wizard-form-grid">
            <label>
              <span>Benchmark Name</span>
              <input
                onChange={(e) => setBenchmarkName(e.target.value)}
                type="text"
                value={benchmarkName}
              />
            </label>
            <label>
              <span>Protocol Name</span>
              <input
                onChange={(e) => setProtocolName(e.target.value)}
                type="text"
                value={protocolName}
              />
            </label>
            <label>
              <span>Benchmark Type</span>
              <select
                onChange={(e) =>
                  setBenchmarkType(e.target.value as CustomBenchmarkDefinition["benchmarkType"])
                }
                value={benchmarkType}
              >
                {benchmarkTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Risk Mode</span>
              <select
                onChange={(e) => setRiskMode(e.target.value as BenchmarkRiskMode)}
                value={riskMode}
              >
                {riskModes.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="benchmark-wizard-span">
              <span>ABI / Interface</span>
              <textarea
                onChange={(e) => setInterfaceAbi(e.target.value)}
                rows={4}
                value={interfaceAbi}
              />
            </label>
            <label className="benchmark-wizard-span">
              <span>
                Target Contract Address{" "}
                <em className="benchmark-wizard-optional">(optional — ABI-only if empty)</em>
              </span>
              <input
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                type="text"
                value={contractAddress}
              />
            </label>
          </div>
        </div>
      )}

      {/* ── Step 2: Scenario ── */}
      {step === "scenario" && (
        <div className="benchmark-wizard-panel">
          <div className="benchmark-wizard-panel-header">
            <h4>Scenario</h4>
            <p>
              Describe the situation the agent must reason about. Use plain language — the AI will
              structure it into a benchmark scenario.
            </p>
          </div>

          {benchmarkType === "dex-trading" && (
            <div className="benchmark-template-grid">
              {dexScenarioProfiles.map((profile) => (
                <button
                  className={`benchmark-template-card ${dexScenarioProfile === profile.value ? "selected" : ""}`}
                  key={profile.value}
                  onClick={() => setDexScenarioProfile(profile.value)}
                  type="button"
                >
                  <strong>{profile.label}</strong>
                  <span>{profile.description}</span>
                </button>
              ))}
            </div>
          )}

          <div className="form-grid benchmark-wizard-form-grid">
            <label className="benchmark-wizard-span">
              <span>Objective</span>
              <textarea
                onChange={(e) => setObjective(e.target.value)}
                rows={4}
                value={objective}
              />
            </label>
            <label className="benchmark-wizard-span">
              <span>Scenario / Market Data</span>
              <textarea
                onChange={(e) => setScenarioText(e.target.value)}
                rows={4}
                value={scenarioText}
              />
            </label>
          </div>
        </div>
      )}

      {/* ── Step 3: Actions ── */}
      {step === "actions" && (
        <div className="benchmark-wizard-panel">
          <div className="benchmark-wizard-panel-header">
            <h4>Actions</h4>
            <p>Define what the agent is allowed to call and what must be blocked.</p>
          </div>

          <div className="benchmark-actions-section">
            <div className="benchmark-actions-label">
              <span>Allowed Actions</span>
              <button className="secondary-action compact" onClick={addActionRow} type="button">
                + Add
              </button>
            </div>
            <div className="benchmark-action-header-row">
              <span>Name</span>
              <span>Signature</span>
              <span>Description</span>
              <span />
            </div>
            <div className="benchmark-action-rows">
              {allowedActionRows.map((row, idx) => (
                <div className="benchmark-action-row" key={idx}>
                  <input
                    onChange={(e) => updateActionRow(idx, "name", e.target.value)}
                    placeholder="name"
                    type="text"
                    value={row.name}
                  />
                  <input
                    onChange={(e) => updateActionRow(idx, "signature", e.target.value)}
                    placeholder="fn(uint256)"
                    type="text"
                    value={row.signature}
                  />
                  <input
                    className="benchmark-action-row-desc"
                    onChange={(e) => updateActionRow(idx, "description", e.target.value)}
                    placeholder="What this action does"
                    type="text"
                    value={row.description}
                  />
                  <button
                    aria-label="Remove action"
                    className="benchmark-row-remove"
                    onClick={() => removeActionRow(idx)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="benchmark-actions-section">
            <div className="benchmark-actions-label">
              <span>Blocked Actions</span>
            </div>
            <div className="benchmark-list-items">
              {blockedActions.map((action, idx) => (
                <div className="benchmark-list-item" key={idx}>
                  <span>{action}</span>
                  <button
                    aria-label="Remove"
                    className="benchmark-row-remove"
                    onClick={() => removeBlockedAction(idx)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="benchmark-add-row">
              <input
                onChange={(e) => setNewBlockedAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBlockedAction();
                  }
                }}
                placeholder="Add blocked action..."
                type="text"
                value={newBlockedAction}
              />
              <button className="secondary-action compact" onClick={addBlockedAction} type="button">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Scoring ── */}
      {step === "scoring" && (
        <div className="benchmark-wizard-panel">
          <div className="benchmark-wizard-panel-header">
            <h4>Scoring</h4>
            <p>
              Define how Nexora grades the agent. This is the benchmark answer key — the AI will
              generate a complete version, but you can customize it here first.
            </p>
          </div>

          <div className="form-grid benchmark-wizard-form-grid">
            <label>
              <span>Expected Decision</span>
              <select
                onChange={(e) => setExpectedDecision(e.target.value)}
                value={expectedDecision}
              >
                <option value="auto">Auto — derived from scenario</option>
                <option value="execute">Execute</option>
                <option value="reject">Reject</option>
                <option value="inspect">Inspect</option>
              </select>
            </label>
          </div>

          <div className="benchmark-actions-section">
            <div className="benchmark-actions-label">
              <span>Scoring Rules</span>
            </div>
            <div className="benchmark-list-items">
              {scoringRules.map((rule, idx) => (
                <div className="benchmark-list-item" key={idx}>
                  <span>{rule}</span>
                  <button
                    aria-label="Remove rule"
                    className="benchmark-row-remove"
                    onClick={() => removeScoringRule(idx)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="benchmark-add-row">
              <input
                onChange={(e) => setNewScoringRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addScoringRule();
                  }
                }}
                placeholder="Add scoring rule..."
                type="text"
                value={newScoringRule}
              />
              <button className="secondary-action compact" onClick={addScoringRule} type="button">
                Add
              </button>
            </div>
          </div>

          <div className="benchmark-actions-section">
            <label className="benchmark-wizard-span">
              <span>Expected Reasoning</span>
              <textarea
                onChange={(e) => setExpectedReasoning(e.target.value)}
                rows={4}
                value={expectedReasoning}
              />
            </label>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {step === "preview" && benchmark && (
        <section className="tool-builder-panel" aria-label="Generated benchmark">
          <div className="console-topline">
            <span>{benchmark.name}</span>
            <span className="status-pill status-ready">Ready to store</span>
          </div>
          {notice && <p className="ownership-note">{notice}</p>}

          <div className="benchmark-preview-grid">
            <div className="benchmark-preview-meta">
              <dl className="benchmark-preview-dl">
                <div>
                  <dt>Type</dt>
                  <dd>{benchmark.benchmarkType}</dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd>{benchmark.riskMode}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>
                    {benchmark.targetContracts.length
                      ? benchmark.targetContracts
                          .map((a) => `${a.slice(0, 6)}...${a.slice(-4)}`)
                          .join(", ")
                      : "ABI-only"}
                  </dd>
                </div>
              </dl>
              <p className="benchmark-preview-objective">{benchmark.description}</p>
            </div>

            <div className="benchmark-preview-col">
              <div className="benchmark-preview-section">
                <h5>Allowed Actions</h5>
                <ul className="capability-list allowed">
                  {benchmark.allowedActions.map((a) => (
                    <li key={actionLabel(a)}>{actionLabel(a)}</li>
                  ))}
                </ul>
              </div>
              <div className="benchmark-preview-section">
                <h5>Blocked Actions</h5>
                <ul className="capability-list restricted">
                  {benchmark.blockedActions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="benchmark-preview-col">
              <div className="benchmark-preview-section">
                <h5>Scoring Rules</h5>
                <ul className="capability-list allowed">
                  {benchmark.scoringRules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              {benchmark.expectedAnswer && (
                <div className="benchmark-preview-section">
                  <h5>Expected Answer</h5>
                  <p className="benchmark-preview-decision">
                    {benchmark.expectedAnswer.decision ?? "Auto"}
                  </p>
                  <p className="benchmark-preview-reasoning">{benchmark.expectedAnswer.reasoning}</p>
                </div>
              )}
            </div>
          </div>

          <div className="benchmark-json-editor">
            <div className="console-topline">
              <span>Editable Benchmark JSON</span>
              <button
                className="secondary-action compact"
                onClick={applyBenchmarkJson}
                type="button"
              >
                Apply JSON
              </button>
            </div>
            <textarea
              aria-label="Editable benchmark JSON"
              onChange={(e) => setBenchmarkJson(e.target.value)}
              rows={16}
              value={benchmarkJson}
            />
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="setup-action-row">
        {step !== "target" && !isPreview && (
          <button className="secondary-action" onClick={goBack} type="button">
            Back
          </button>
        )}
        {isPreview && (
          <button className="secondary-action" onClick={goBack} type="button">
            Back to Edit
          </button>
        )}

        {step !== "scoring" && !isPreview && (
          <button className="primary-action" onClick={goNext} type="button">
            Next
          </button>
        )}

        {step === "scoring" && (
          <button
            className="primary-action"
            disabled={isGenerating}
            onClick={() => void generateBenchmark()}
            type="button"
          >
            {isGenerating ? "Generating..." : "Generate Benchmark"}
          </button>
        )}

        {isPreview && (
          <button
            className="primary-action"
            disabled={!isConnected || !isBenchmarkRegistryReady() || isSaving}
            onClick={() => void saveBenchmark()}
            type="button"
          >
            {isSaving ? "Storing..." : "Confirm and Store On-chain"}
          </button>
        )}
      </div>

      {isPreview && !isConnected && <ConnectWalletButton />}
      {isPreview && !isBenchmarkRegistryReady() && (
        <p className="ownership-note">Deploy the benchmark registry before storing benchmarks.</p>
      )}
    </section>
  );
}
