"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  createSmartWalletOnchain,
  createSmartWalletProfileOnchain,
} from "@/lib/contracts/onchainSmartWallets";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { NetworkSwitcher } from "../wallet/NetworkSwitcher";

const steps = ["Wallet", "Review"];
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

export function AgentCreationWizard() {
  const router = useRouter();
  const { address, isReady, readiness } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("YieldGuard-01");
  const [description, setDescription] = useState("Treasury risk monitor");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState("");

  const displayReadiness = isMounted ? readiness : "disconnected";
  const canCreate = Boolean(isMounted && address && isReady && !isCreating);
  const isReviewStep = stepIndex === steps.length - 1;

  useEffect(() => {
    setIsMounted(true);
    try {
      const raw = localStorage.getItem(wizardDraftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.stepIndex === "number") {
        setStepIndex(Math.min(Math.max(draft.stepIndex, 0), steps.length - 1));
      }
      if (typeof draft.name === "string") setName(draft.name);
      if (typeof draft.description === "string") setDescription(draft.description);
    } catch {
      // Ignore malformed local drafts.
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
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
  }, [description, isMounted, name, stepIndex]);

  const resetDraft = () => {
    clearWizardDraft();
    setStepIndex(0);
    setName("YieldGuard-01");
    setDescription("Treasury risk monitor");
    setError("");
    setCreationStatus("");
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
    setStepIndex(0);
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
      router.push(`/wallets/${wallet.id}`);
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
              setError("");
              setStepIndex(index);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
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
              <dd>Fund the smart wallet and configure the local runner.</dd>
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
          disabled={stepIndex === 0 || isCreating}
          onClick={goBack}
          type="button"
        >
          Back
        </button>

        {isReviewStep ? (
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
