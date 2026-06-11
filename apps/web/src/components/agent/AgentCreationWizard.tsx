"use client";

import { useEffect, useState } from "react";
import type { AgentRecord } from "@nexora/shared";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { saveExecutorPolicyOnchain } from "@/lib/contracts/onchainAutonomy";
import {
  createSmartWalletOnchain,
  createSmartWalletProfileOnchain,
} from "@/lib/contracts/onchainSmartWallets";
import { getRunnerStatus } from "@/lib/runner/runnerClient";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { NetworkSwitcher } from "../wallet/NetworkSwitcher";

const creationSteps = ["Wallet", "Review"];
const setupSteps = ["Wallet", "Review", "Link Executor"];
const wizardDraftKey = "nexora_wizard_draft_v1";

function clearWizardDraft() {
  try {
    localStorage.removeItem(wizardDraftKey);
  } catch {
    // Local storage can be unavailable in strict browser modes.
  }
}

function humanReadableError(message: string) {
  return (
    message
      .split("\n\n")[0]
      .replace(/\s+Request Arguments:[\s\S]*$/, "")
      .replace(/\s+Contract Call:[\s\S]*$/, "")
      .trim() || message.slice(0, 200)
  );
}

function asHexAddress(address?: string): `0x${string}` | undefined {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return undefined;
  }

  return address as `0x${string}`;
}

function isPositiveDecimal(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function AgentCreationWizard({
  onComplete,
}: {
  onComplete?: (wallet: AgentRecord) => void | Promise<void>;
}) {
  const { address, isReady, readiness } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("YieldGuard-01");
  const [description, setDescription] = useState("Treasury risk monitor");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLinkingExecutor, setIsLinkingExecutor] = useState(false);
  const [creationStatus, setCreationStatus] = useState("");
  const [createdWallet, setCreatedWallet] = useState<AgentRecord | undefined>();
  const [executorAddress, setExecutorAddress] = useState("");
  const [maxActionMnt, setMaxActionMnt] = useState("0.01");
  const [dailyLimitMnt, setDailyLimitMnt] = useState("0.05");
  const [validHours, setValidHours] = useState("24");

  const displayReadiness = isMounted ? readiness : "disconnected";
  const steps = createdWallet ? setupSteps : creationSteps;
  const isReviewStep = stepIndex === 1 && !createdWallet;
  const isLinkStep = Boolean(createdWallet) && stepIndex === 2;
  const maxActionNumber = Number(maxActionMnt);
  const dailyLimitNumber = Number(dailyLimitMnt);
  const validHoursNumber = Number(validHours);
  const canCreate = Boolean(isMounted && address && isReady && !isCreating);
  const canLinkExecutor = Boolean(
    createdWallet?.walletAddress &&
      createdWallet.agentIdentityId &&
      asHexAddress(executorAddress) &&
      isPositiveDecimal(maxActionMnt) &&
      isPositiveDecimal(dailyLimitMnt) &&
      dailyLimitNumber >= maxActionNumber &&
      Number.isFinite(validHoursNumber) &&
      validHoursNumber > 0 &&
      !isLinkingExecutor,
  );

  useEffect(() => {
    setIsMounted(true);
    try {
      const raw = localStorage.getItem(wizardDraftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.stepIndex === "number") {
        setStepIndex(
          Math.min(Math.max(draft.stepIndex, 0), creationSteps.length - 1),
        );
      }
      if (typeof draft.name === "string") setName(draft.name);
      if (typeof draft.description === "string") setDescription(draft.description);
    } catch {
      // Ignore malformed local drafts.
    }
  }, []);

  useEffect(() => {
    if (!isMounted || createdWallet) return;
    try {
      localStorage.setItem(
        wizardDraftKey,
        JSON.stringify({
          description,
          name,
          stepIndex,
        }),
      );
    } catch {
      // Ignore local storage write failures.
    }
  }, [createdWallet, description, isMounted, name, stepIndex]);

  const resetDraft = () => {
    clearWizardDraft();
    setStepIndex(0);
    setName("YieldGuard-01");
    setDescription("Treasury risk monitor");
    setError("");
    setCreationStatus("");
    setCreatedWallet(undefined);
    setExecutorAddress("");
    setMaxActionMnt("0.01");
    setDailyLimitMnt("0.05");
    setValidHours("24");
  };

  const validateWalletDetails = () => {
    if (!name.trim()) {
      setError("Smart wallet name is required.");
      return false;
    }

    if (!description.trim()) {
      setError("Smart wallet description is required.");
      return false;
    }

    return true;
  };

  const goNext = () => {
    setError("");

    if (!validateWalletDetails()) {
      return;
    }

    setStepIndex(1);
  };

  const goBack = () => {
    setError("");
    setStepIndex(createdWallet ? 1 : 0);
  };

  const loadExecutorAddress = async () => {
    try {
      const status = await getRunnerStatus();
      setExecutorAddress(status.executorAddress ?? "");

      if (!status.executorAddress) {
        setError("Start Nexora locally with pnpm nexora to create or load an executor key.");
      }
    } catch {
      setExecutorAddress("");
      setError("Runner API is not reachable. Start Nexora locally with pnpm nexora.");
    }
  };

  const createSmartWallet = async () => {
    setError("");

    if (!validateWalletDetails()) {
      setStepIndex(0);
      return;
    }

    if (!address || !isReady) {
      setError("Connect your wallet before creating a smart wallet.");
      return;
    }

    setIsCreating(true);
    setCreationStatus("Creating smart wallet on Mantle...");

    try {
      let wallet = await createSmartWalletProfileOnchain({
        agentType: "custom",
        avoidedBehavior: "Configured in local runner",
        decisionStyle: "Configured in local runner",
        description: description.trim(),
        name: name.trim(),
        ownerAddress: address,
        preferredBehavior: "Configured in local runner",
        primaryPurpose: description.trim(),
        riskMode: "conservative",
        runnerMode: "local",
        runtime: "nexora-local",
        selectedHarnessId: "safe-approval",
        strategyType: "defensive",
      });

      setCreationStatus("Smart wallet confirmed. Loading wallet...");
      wallet = await createSmartWalletOnchain(wallet, address);
      clearWizardDraft();
      setCreatedWallet(wallet);
      setStepIndex(2);
      setCreationStatus("Smart wallet created. Link the local executor to finish setup.");
      await loadExecutorAddress();
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

  const linkExecutor = async () => {
    setError("");

    if (!createdWallet?.walletAddress || !createdWallet.agentIdentityId) {
      setError("Smart wallet is still loading. Try again in a few seconds.");
      return;
    }

    const executor = asHexAddress(executorAddress);

    if (!executor) {
      setError("Runner key not configured. Start Nexora locally with pnpm nexora.");
      return;
    }

    if (!isPositiveDecimal(maxActionMnt)) {
      setError("Max action MNT must be greater than zero.");
      return;
    }

    if (!isPositiveDecimal(dailyLimitMnt)) {
      setError("Daily limit MNT must be greater than zero.");
      return;
    }

    if (dailyLimitNumber < maxActionNumber) {
      setError("Daily limit must be greater than or equal to max action MNT.");
      return;
    }

    if (!Number.isFinite(validHoursNumber) || validHoursNumber <= 0) {
      setError("Valid hours must be greater than zero.");
      return;
    }

    setIsLinkingExecutor(true);
    setCreationStatus("Linking executor. Confirm the transaction in your wallet...");

    try {
      await saveExecutorPolicyOnchain({
        agentId: createdWallet.agentIdentityId,
        dailyLimitMnt,
        enabled: true,
        executor,
        maxValuePerActionMnt: maxActionMnt,
        validForHours: validHoursNumber,
        walletAddress: createdWallet.walletAddress,
      });

      setCreationStatus("Executor linked. Smart wallet is ready for benchmark setup.");
      setIsLinkingExecutor(false);
      await onComplete?.(createdWallet);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? humanReadableError(caughtError.message)
          : "Could not link executor.",
      );
      setIsLinkingExecutor(false);
    }
  };

  return (
    <section className="agent-create-modal" aria-label="Create smart wallet">
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
            onClick={() => {
              if (index === 2 && !createdWallet) return;
              setError("");
              setStepIndex(index);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (index === 2 && !createdWallet) return;
                setError("");
                setStepIndex(index);
              }
            }}
            role="button"
            tabIndex={0}
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
          <section className="wizard-review" aria-label="Creation summary">
            <dl>
              <div>
                <dt>Network</dt>
                <dd>Mantle Sepolia</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{address ?? "Connect wallet"}</dd>
              </div>
              <div>
                <dt>Runner</dt>
                <dd>Configured from Agent Configuration</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {isReviewStep && (
        <section className="wizard-review" aria-label="Smart wallet review">
          <dl>
            <div>
              <dt>Wallet Name</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{description}</dd>
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
              <dt>Next Step</dt>
              <dd>Link the local executor in this modal.</dd>
            </div>
          </dl>
        </section>
      )}

      {isLinkStep && createdWallet && (
        <section className="wizard-review" aria-label="Link executor">
          <dl>
            <div>
              <dt>Smart Wallet</dt>
              <dd title={createdWallet.walletAddress}>
                {createdWallet.walletAddress ?? "Loading wallet address"}
              </dd>
            </div>
            <div>
              <dt>Agent Identity</dt>
              <dd>
                {createdWallet.agentIdentityId
                  ? `ERC-8004 #${createdWallet.agentIdentityId}`
                  : "Loading identity"}
              </dd>
            </div>
            <div>
              <dt>Executor</dt>
              <dd title={executorAddress}>
                {executorAddress || "Runner key not configured"}
              </dd>
            </div>
          </dl>

          <div className="form-grid">
            <label>
              <span>Max MNT Per Action</span>
              <input
                min="0"
                onChange={(event) => setMaxActionMnt(event.target.value)}
                step="0.001"
                type="number"
                value={maxActionMnt}
              />
            </label>

            <label>
              <span>Daily MNT Limit</span>
              <input
                min="0"
                onChange={(event) => setDailyLimitMnt(event.target.value)}
                step="0.001"
                type="number"
                value={dailyLimitMnt}
              />
            </label>

            <label>
              <span>Valid Hours</span>
              <input
                min="1"
                onChange={(event) => setValidHours(event.target.value)}
                step="1"
                type="number"
                value={validHours}
              />
            </label>
          </div>
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
          disabled={stepIndex === 0 || isCreating || isLinkingExecutor}
          onClick={goBack}
          type="button"
        >
          Back
        </button>

        {isLinkStep ? (
          <button
            className="primary-action"
            disabled={!canLinkExecutor}
            onClick={() => void linkExecutor()}
            type="button"
          >
            {isLinkingExecutor ? "Linking..." : "Link Executor"}
          </button>
        ) : isReviewStep ? (
          <button
            className="primary-action"
            disabled={!canCreate}
            onClick={() => void createSmartWallet()}
            type="button"
          >
            {isCreating ? "Creating..." : "Create Smart Wallet"}
          </button>
        ) : (
          <button className="primary-action" onClick={goNext} type="button">
            Review
          </button>
        )}
      </div>
    </section>
  );
}
