"use client";

import type {
  AgentStrategyType,
  AgentType,
  HarnessId,
  RiskMode,
  RunnerMode,
  SmartWalletModelConnectionType,
  SmartWalletModelConfig,
  SmartWalletToolConfig,
} from "@nexora/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  createSmartWalletOnchain,
  createSmartWalletProfileOnchain,
} from "@/lib/contracts/onchainSmartWallets";
import {
  getAllHarnessTemplates,
  getHarnessTemplate,
  harnessTemplates,
} from "@/lib/harness/harnessTemplates";
import {
  defaultToolsForHarness,
  modelConfigForRunner,
  toolGroupLabel,
  toolStatusLabel,
} from "@/lib/smartWalletDefinition";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { NetworkSwitcher } from "../wallet/NetworkSwitcher";

const steps = [
  "Mission",
  "Model",
  "Tools",
  "Policy",
  "Deploy Wallet",
  "Review",
];

const agentTypes: Array<{ label: string; value: AgentType }> = [
  { label: "Wallet Defense", value: "wallet-defense" },
  { label: "Safe Yield", value: "safe-yield" },
  { label: "Trading", value: "trading" },
  { label: "Custom", value: "custom" },
];

const riskModes: Array<{ label: string; value: RiskMode }> = [
  { label: "Conservative", value: "conservative" },
  { label: "Balanced", value: "balanced" },
  { label: "Aggressive", value: "experimental" },
];

const runnerModes: Array<{
  disabled?: boolean;
  label: string;
  value: RunnerMode;
}> = [
  { label: "Demo Runner", value: "demo" },
  { label: "Local Runner", value: "local" },
  { disabled: true, label: "Hosted Runner", value: "hosted" },
];

const connectionTypes: Array<{
  label: string;
  value: SmartWalletModelConnectionType;
}> = [
  { label: "Demo Model", value: "demo" },
  { label: "OpenAI-compatible", value: "openai-compatible" },
  { label: "Ollama-compatible", value: "ollama-compatible" },
  { label: "Custom HTTP", value: "custom-http" },
];

function formatValue(value: string) {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const WIZARD_DRAFT_KEY = "nexora_wizard_draft_v1";

function clearWizardDraft(): void {
  try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch {}
}

function humanReadableError(msg: string): string {
  // viem errors append full call data (contract address, encoded args, etc.) after the
  // human-readable sentence — strip everything from "Request Arguments:" or "Contract Call:" onward
  return msg
    .split("\n\n")[0]
    .replace(/\s+Request Arguments:[\s\S]*$/, "")
    .replace(/\s+Contract Call:[\s\S]*$/, "")
    .trim() || msg.slice(0, 200);
}

export function AgentCreationWizard() {
  const router = useRouter();
  const { address, isReady, readiness } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("YieldGuard-01");
  const [description, setDescription] = useState("Treasury risk monitor");
  const [agentType, setAgentType] = useState<AgentType>("wallet-defense");
  const [riskMode, setRiskMode] = useState<RiskMode>("conservative");
  const [strategyType] = useState<AgentStrategyType>("defensive");
  const [primaryPurpose, setPrimaryPurpose] = useState(
    "Monitor DeFi activity and propose low-risk wallet actions.",
  );
  const [decisionStyle, setDecisionStyle] = useState("Conservative");
  const [preferredBehavior, setPreferredBehavior] = useState(
    "Prefer bounded approvals, verified contracts, and clear risk reports.",
  );
  const [avoidedBehavior, setAvoidedBehavior] = useState(
    "Avoid unlimited approvals, unverified contracts, and high-risk pools.",
  );
  const [selectedHarnessId, setSelectedHarnessId] =
    useState<HarnessId>("safe-approval");
  const [availableHarnesses, setAvailableHarnesses] = useState(harnessTemplates);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>("demo");
  const [modelConfig, setModelConfig] = useState<SmartWalletModelConfig>(
    modelConfigForRunner("demo"),
  );
  const [toolsConfig, setToolsConfig] = useState<SmartWalletToolConfig[]>(
    defaultToolsForHarness("safe-approval"),
  );
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState("");

  const displayReadiness = isMounted ? readiness : "disconnected";
  const canCreate = Boolean(isMounted && address && isReady && !isCreating);
  const isReviewStep = stepIndex === steps.length - 1;
  const selectedHarness =
    availableHarnesses.find((harness) => harness.id === selectedHarnessId) ??
    getHarnessTemplate(selectedHarnessId);

  useEffect(() => {
    setIsMounted(true);
    setAvailableHarnesses(getAllHarnessTemplates());
    try {
      const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.stepIndex === "number") setStepIndex(d.stepIndex);
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.description === "string") setDescription(d.description);
      if (d.agentType) setAgentType(d.agentType as AgentType);
      if (d.riskMode) setRiskMode(d.riskMode as RiskMode);
      if (typeof d.primaryPurpose === "string") setPrimaryPurpose(d.primaryPurpose);
      if (typeof d.decisionStyle === "string") setDecisionStyle(d.decisionStyle);
      if (typeof d.preferredBehavior === "string") setPreferredBehavior(d.preferredBehavior);
      if (typeof d.avoidedBehavior === "string") setAvoidedBehavior(d.avoidedBehavior);
      if (d.selectedHarnessId) setSelectedHarnessId(d.selectedHarnessId as HarnessId);
      if (d.runnerMode) setRunnerMode(d.runnerMode as RunnerMode);
      if (d.modelConfig) setModelConfig(d.modelConfig as SmartWalletModelConfig);
      if (d.toolsConfig) setToolsConfig(d.toolsConfig as SmartWalletToolConfig[]);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(
        WIZARD_DRAFT_KEY,
        JSON.stringify({
          stepIndex,
          name,
          description,
          agentType,
          riskMode,
          primaryPurpose,
          decisionStyle,
          preferredBehavior,
          avoidedBehavior,
          selectedHarnessId,
          runnerMode,
          modelConfig,
          toolsConfig,
        }),
      );
    } catch {}
  }, [
    isMounted,
    stepIndex,
    name,
    description,
    agentType,
    riskMode,
    primaryPurpose,
    decisionStyle,
    preferredBehavior,
    avoidedBehavior,
    selectedHarnessId,
    runnerMode,
    modelConfig,
    toolsConfig,
  ]);

  const resetDraft = () => {
    clearWizardDraft();
    setStepIndex(0);
    setName("YieldGuard-01");
    setDescription("Treasury risk monitor");
    setAgentType("wallet-defense");
    setRiskMode("conservative");
    setPrimaryPurpose("Monitor DeFi activity and propose low-risk wallet actions.");
    setDecisionStyle("Conservative");
    setPreferredBehavior("Prefer bounded approvals, verified contracts, and clear risk reports.");
    setAvoidedBehavior("Avoid unlimited approvals, unverified contracts, and high-risk pools.");
    setSelectedHarnessId("safe-approval");
    setRunnerMode("demo");
    setModelConfig(modelConfigForRunner("demo"));
    setToolsConfig(defaultToolsForHarness("safe-approval"));
    setError("");
  };

  const validateCurrentStep = () => {
    if (stepIndex === 0) {
      if (!name.trim()) {
        setError("Smart wallet name is required.");
        return false;
      }

      if (!description.trim()) {
        setError("Smart wallet description is required.");
        return false;
      }
    }

    if (stepIndex === 0 && !primaryPurpose.trim()) {
      setError("Primary purpose is required.");
      return false;
    }

    return true;
  };

  const goNext = () => {
    setError("");

    if (!validateCurrentStep()) {
      return;
    }

    setStepIndex((currentStep) => Math.min(currentStep + 1, steps.length - 1));
  };

  const goBack = () => {
    setError("");
    setStepIndex((currentStep) => Math.max(currentStep - 1, 0));
  };

  const createAgent = async () => {
    setError("");

    if (!name.trim() || !description.trim()) {
      setStepIndex(0);
      setError("Smart wallet name and description are required.");
      return;
    }

    if (!address || !isReady) {
      setError("Connect your wallet before creating a smart wallet.");
      return;
    }

    setIsCreating(true);
    setCreationStatus("Registering smart wallet profile...");

    try {
      let agent = await createSmartWalletProfileOnchain({
        name: name.trim(),
        description: description.trim(),
        agentType,
        runtime: "nexora-local",
        runnerMode: modelConfig.runnerMode,
        modelConfig,
        toolsConfig,
        strategyType,
        primaryPurpose: primaryPurpose.trim(),
        decisionStyle: decisionStyle.trim(),
        preferredBehavior: preferredBehavior.trim(),
        avoidedBehavior: avoidedBehavior.trim(),
        selectedHarnessId,
        riskMode,
        ownerAddress: address,
      });

      setCreationStatus("Profile confirmed. Deploying smart wallet...");
      agent = await createSmartWalletOnchain(agent, address);
      setCreationStatus(
        agent.walletAddress
          ? "Smart wallet deployed. Opening wallet..."
          : "Deployment confirmed. Waiting for wallet address to appear...",
      );

      clearWizardDraft();
      router.push(`/wallets/${agent.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? humanReadableError(caughtError.message)
          : "Could not create smart wallet.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="agent-create-modal" aria-label="Create smart wallet wizard">
      <div className="modal-topline">
        <div>
          <h2>Create Smart Wallet</h2>
          <span>{steps[stepIndex]}</span>
        </div>
        <div className="modal-topline-actions">
          <span className="status-pill status-ready">
            {stepIndex + 1} / {steps.length}
          </span>
          <button
            className="wizard-reset-action"
            onClick={resetDraft}
            title="Reset all fields to defaults"
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      <ol className="wizard-steps" aria-label="Smart wallet creation steps">
        {steps.map((step, index) => (
          <li
            aria-current={index === stepIndex ? "step" : undefined}
            className={
              index === stepIndex
                ? "wizard-step-active"
                : index < stepIndex
                  ? "wizard-step-visited"
                  : "wizard-step-future"
            }
            key={step}
            onClick={() => { setError(""); setStepIndex(index); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setError("");
                setStepIndex(index);
              }
            }}
          >
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      {stepIndex === 0 && (
        <div className="form-grid">
          <label>
            <span>Wallet Name</span>
            <input
              aria-label="Smart Wallet Name"
              onChange={(event) => setName(event.target.value)}
              type="text"
              value={name}
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              aria-label="Description"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
          <fieldset className="wizard-fieldset">
            <legend>Mission Type</legend>
            <div className="choice-grid">
              {agentTypes.map((type) => (
                <label className="choice-card" key={type.value}>
                  <input
                    checked={agentType === type.value}
                    name="agent-type"
                    onChange={() => setAgentType(type.value)}
                    type="radio"
                    value={type.value}
                  />
                  <span>
                    <strong>{type.label}</strong>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="wizard-fieldset">
            <legend>Risk Style</legend>
            <div className="segmented-control">
              {riskModes.map((mode) => (
                <label key={mode.value}>
                  <input
                    checked={riskMode === mode.value}
                    name="risk-mode"
                    onChange={() => setRiskMode(mode.value)}
                    type="radio"
                    value={mode.value}
                  />
                  <span>{mode.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span>Primary Goal</span>
            <textarea
              aria-label="Primary Purpose"
              onChange={(event) => setPrimaryPurpose(event.target.value)}
              value={primaryPurpose}
            />
          </label>
          <label>
            <span>Decision Style</span>
            <input
              aria-label="Decision Style"
              onChange={(event) => setDecisionStyle(event.target.value)}
              type="text"
              value={decisionStyle}
            />
          </label>
          <label>
            <span>Preferred Behavior</span>
            <textarea
              aria-label="Preferred Behavior"
              onChange={(event) => setPreferredBehavior(event.target.value)}
              value={preferredBehavior}
            />
          </label>
          <label>
            <span>Avoided Behavior</span>
            <textarea
              aria-label="Avoided Behavior"
              onChange={(event) => setAvoidedBehavior(event.target.value)}
              value={avoidedBehavior}
            />
          </label>
        </div>
      )}

      {stepIndex === 1 && (
        <fieldset className="wizard-fieldset">
          <legend>Model</legend>
          <div className="choice-grid">
            {runnerModes.map((mode) => (
              <label className="choice-card" key={mode.value}>
                <input
                  checked={runnerMode === mode.value}
                  disabled={mode.disabled}
                  name="runner-mode"
                  onChange={() => {
                    setRunnerMode(mode.value);
                    setModelConfig(modelConfigForRunner(mode.value));
                  }}
                  type="radio"
                  value={mode.value}
                />
                <span>
                  <strong>{mode.label}</strong>
                  <small>{mode.disabled ? "Coming soon" : "Available"}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="form-grid">
            <label>
              <span>Provider</span>
              <input aria-label="Model provider" readOnly type="text" value={modelConfig.provider} />
            </label>
            <label>
              <span>Connection Type</span>
              <select
                aria-label="Model connection type"
                onChange={(event) =>
                  setModelConfig((current) => ({
                    ...current,
                    connectionType: event.target.value as SmartWalletModelConnectionType,
                  }))
                }
                value={modelConfig.connectionType ?? "demo"}
              >
                {connectionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Model Name</span>
              <input
                aria-label="Model name"
                onChange={(event) =>
                  setModelConfig((current) => ({ ...current, modelName: event.target.value }))
                }
                type="text"
                value={modelConfig.modelName}
              />
            </label>
            {modelConfig.provider === "local" && (
              <label>
                <span>Endpoint URL</span>
                <input
                  aria-label="Endpoint URL"
                  onChange={(event) =>
                    setModelConfig((current) => ({ ...current, endpointUrl: event.target.value }))
                  }
                  type="text"
                  value={modelConfig.endpointUrl ?? ""}
                />
              </label>
            )}
            <div className="segmented-control">
              <label>
                <input
                  checked={modelConfig.executionMode === "simulation"}
                  name="execution-mode"
                  onChange={() =>
                    setModelConfig((current) => ({ ...current, executionMode: "simulation" }))
                  }
                  type="radio"
                />
                <span>Simulation</span>
              </label>
              <label>
                <input
                  checked={modelConfig.executionMode === "policy-gated"}
                  name="execution-mode"
                  onChange={() =>
                    setModelConfig((current) => ({ ...current, executionMode: "policy-gated" }))
                  }
                  type="radio"
                />
                <span>Policy gated</span>
              </label>
              <label>
                <input
                  checked={modelConfig.executionMode === "live-disabled"}
                  name="execution-mode"
                  onChange={() =>
                    setModelConfig((current) => ({ ...current, executionMode: "live-disabled" }))
                  }
                  type="radio"
                />
                <span>Live disabled</span>
              </label>
            </div>
          </div>
        </fieldset>
      )}

      {stepIndex === 2 && (
        <div className="form-grid">
          <div className="wizard-harness-grid">
            {availableHarnesses.map((harness) => (
              <button
                aria-pressed={selectedHarnessId === harness.id}
                className={
                  selectedHarnessId === harness.id
                    ? "harness-card harness-card-selected"
                    : "harness-card"
                }
                key={harness.id}
                onClick={() => {
                  setSelectedHarnessId(harness.id);
                  setToolsConfig(defaultToolsForHarness(harness.id));
                }}
                type="button"
              >
                <span>{harness.name}</span>
                <small>{harness.tools.map((tool) => tool.name).join(", ")}</small>
                <small>Blocked: {harness.blockedActionTypes.join(", ")}</small>
                <small>
                  Scoring: {harness.scoringRules.map((rule) => rule.label).join(", ")}
                </small>
              </button>
            ))}
          </div>
          <section className="wizard-review" aria-label="Selected tools">
            <dl>
              {toolsConfig.map((tool) => (
                <div key={tool.id}>
                  <dt>{toolGroupLabel(tool.group)}</dt>
                  <dd>
                    {tool.name} · {toolStatusLabel(tool.status)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {stepIndex === 3 && (
        <section className="wizard-review" aria-label="Policy review">
          <dl>
            <div>
              <dt>Risk Style</dt>
              <dd>{riskModes.find((mode) => mode.value === riskMode)?.label}</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>Policy checks required before execution</dd>
            </div>
            <div>
              <dt>Blocked Actions</dt>
              <dd>{selectedHarness.blockedActionTypes.join(", ")}</dd>
            </div>
          </dl>
        </section>
      )}

      {stepIndex === 4 && (
        <section className="wizard-review" aria-label="Deploy wallet review">
          <dl>
            <div>
              <dt>Deployment</dt>
              <dd>Smart wallet will be deployed now</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Mantle Sepolia</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{address ?? "Connect wallet"}</dd>
            </div>
            <div>
              <dt>Funding</dt>
              <dd>Fund after deployment</dd>
            </div>
          </dl>
        </section>
      )}

      {isReviewStep && (
        <section className="wizard-review" aria-label="Smart wallet review">
          <dl>
            <div>
              <dt>Wallet Name</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Wallet Type</dt>
              <dd>{agentTypes.find((type) => type.value === agentType)?.label}</dd>
            </div>
            <div>
              <dt>Risk Style</dt>
              <dd>{riskModes.find((mode) => mode.value === riskMode)?.label}</dd>
            </div>
            <div>
              <dt>Strategy</dt>
              <dd>{primaryPurpose}</dd>
            </div>
            <div>
              <dt>Harness</dt>
              <dd>{selectedHarness.name}</dd>
            </div>
            <div>
              <dt>Runner Mode</dt>
              <dd>{formatValue(modelConfig.runnerMode)}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{modelConfig.modelName}</dd>
            </div>
            <div>
              <dt>Tools</dt>
              <dd>{toolsConfig.filter((tool) => tool.enabled).length} enabled</dd>
            </div>
            <div>
              <dt>Smart Wallet</dt>
              <dd>Deploy during creation</dd>
            </div>
            <div>
              <dt>Next Step</dt>
              <dd>Fund the smart wallet</dd>
            </div>
          </dl>
        </section>
      )}

      {displayReadiness === "disconnected" && (
        <div className="form-wallet-callout">
          <ConnectWalletButton />
        </div>
      )}

      {isMounted && <NetworkSwitcher />}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {creationStatus && (
        <p className="success-text" role="status">
          {creationStatus}
        </p>
      )}

      <div className="wizard-actions">
        <button
          className="secondary-action"
          disabled={stepIndex === 0}
          onClick={goBack}
          type="button"
        >
          Back
        </button>

        {isReviewStep ? (
          <button
            className="primary-action"
            disabled={!canCreate}
            onClick={() => void createAgent()}
            type="button"
          >
            {isCreating ? "Creating..." : "Create Smart Wallet"}
          </button>
        ) : (
          <button className="primary-action" onClick={goNext} type="button">
            Next
          </button>
        )}
      </div>
    </section>
  );
}
