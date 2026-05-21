"use client";

import type {
  AgentStrategyType,
  AgentType,
  HarnessId,
  RiskMode,
  RunnerMode,
} from "@nexora/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  createLocalAgent,
  createLocalAgentWallet,
} from "@/lib/agents/localAgentRegistry";
import {
  createAgentWalletOnchain,
  registerAgentIdentityOnchain,
  shouldFallbackToDemoWrite,
} from "@/lib/contracts/onchainAgents";
import {
  getAllHarnessTemplates,
  getHarnessTemplate,
  harnessTemplates,
} from "@/lib/harness/harnessTemplates";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { NetworkSwitcher } from "../wallet/NetworkSwitcher";

const steps = [
  "Wallet Identity",
  "Wallet Strategy",
  "Harness Selection",
  "Runner Mode",
  "Smart Wallet Setup",
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

function formatValue(value: string) {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
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
  const [createWalletNow, setCreateWalletNow] = useState(false);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const displayReadiness = isMounted ? readiness : "disconnected";
  const canCreate = Boolean(isMounted && address && isReady && !isCreating);
  const isReviewStep = stepIndex === steps.length - 1;
  const selectedHarness =
    availableHarnesses.find((harness) => harness.id === selectedHarnessId) ??
    getHarnessTemplate(selectedHarnessId);

  useEffect(() => {
    setIsMounted(true);
    setAvailableHarnesses(getAllHarnessTemplates());
  }, []);

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

    if (stepIndex === 1 && !primaryPurpose.trim()) {
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

    try {
      let onchainRegistration:
        | Awaited<ReturnType<typeof registerAgentIdentityOnchain>>
        | undefined;

      try {
        onchainRegistration = await registerAgentIdentityOnchain(
          "ipfs://nexora-local/agent-{agentId}",
        );
      } catch (caughtError) {
        if (!shouldFallbackToDemoWrite(caughtError)) {
          throw caughtError;
        }
      }

      let agent = createLocalAgent({
        id: onchainRegistration?.agentId,
        name: name.trim(),
        description: description.trim(),
        agentType,
        runtime: "nexora-local",
        runnerMode,
        strategyType,
        primaryPurpose: primaryPurpose.trim(),
        decisionStyle: decisionStyle.trim(),
        preferredBehavior: preferredBehavior.trim(),
        avoidedBehavior: avoidedBehavior.trim(),
        selectedHarnessId,
        riskMode,
        ownerAddress: address,
        identityTransactionHash: onchainRegistration?.transactionHash,
      });

      if (createWalletNow) {
        let onchainWallet:
          | Awaited<ReturnType<typeof createAgentWalletOnchain>>
          | undefined;

        if (agent.identityTransactionHash) {
          try {
            onchainWallet = await createAgentWalletOnchain(agent.id);
          } catch (caughtError) {
            if (!shouldFallbackToDemoWrite(caughtError)) {
              throw caughtError;
            }
          }
        }

        agent = createLocalAgentWallet(
          agent.id,
          address,
          onchainWallet?.walletAddress,
          onchainWallet?.transactionHash,
        );
      }

      router.push(`/wallets/${agent.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
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
        <span className="status-pill status-ready">
          {stepIndex + 1} / {steps.length}
        </span>
      </div>

      <ol className="wizard-steps" aria-label="Smart wallet creation steps">
        {steps.map((step, index) => (
          <li
            className={index === stepIndex ? "wizard-step-active" : ""}
            key={step}
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
            <legend>Wallet Type</legend>
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
        </div>
      )}

      {stepIndex === 1 && (
        <div className="form-grid">
          <label>
            <span>Primary Purpose</span>
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

      {stepIndex === 2 && (
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
              onClick={() => setSelectedHarnessId(harness.id)}
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
      )}

      {stepIndex === 3 && (
        <fieldset className="wizard-fieldset">
          <legend>Runner Mode</legend>
          <div className="choice-grid">
            {runnerModes.map((mode) => (
              <label className="choice-card" key={mode.value}>
                <input
                  checked={runnerMode === mode.value}
                  disabled={mode.disabled}
                  name="runner-mode"
                  onChange={() => setRunnerMode(mode.value)}
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
        </fieldset>
      )}

      {stepIndex === 4 && (
        <fieldset className="wizard-fieldset">
          <legend>Smart Wallet Setup</legend>
          <div className="choice-grid">
            <label className="choice-card">
              <input
                checked={createWalletNow}
                name="smart-wallet-option"
                onChange={() => setCreateWalletNow(true)}
                type="radio"
              />
              <span>
                <strong>Create smart wallet now</strong>
                <small>Actions use only funds inside this smart wallet.</small>
              </span>
            </label>
            <label className="choice-card">
              <input
                checked={!createWalletNow}
                name="smart-wallet-option"
                onChange={() => setCreateWalletNow(false)}
                type="radio"
              />
              <span>
                <strong>Create smart wallet later</strong>
                <small>The smart wallet can be configured before funding.</small>
              </span>
            </label>
          </div>
        </fieldset>
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
              <dd>{formatValue(runnerMode)}</dd>
            </div>
            <div>
              <dt>Smart Wallet</dt>
              <dd>{createWalletNow ? "Create now" : "Create later"}</dd>
            </div>
            <div>
              <dt>Next Step</dt>
              <dd>{createWalletNow ? "Fund the smart wallet" : "Create the smart wallet"}</dd>
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
