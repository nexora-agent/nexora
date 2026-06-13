"use client";

import type { AgentRecord } from "@nexora/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useOnchainRunnerActivity } from "@/hooks/useOnchainRunnerActivity";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { getExternalDefiEligibility } from "@/lib/byreal/externalDefiEligibility";
import { AgentWalletBalance } from "../wallet/AgentWalletBalance";
import { AgentWalletCard } from "../wallet/AgentWalletCard";
import { FundWalletPanel } from "../wallet/FundWalletPanel";
import { AgentStatusBadge, getAgentStatus } from "./AgentStatusBadge";
import { AutonomyControls } from "./AutonomyControls";
import { OnchainAgentReportPanel } from "./OnchainAgentReportPanel";

type DetailTab =
  | "overview"
  | "agent-access"
  | "results";

type AgentProfileCardProps = {
  agent: AgentRecord;
  connectedAddress?: `0x${string}`;
  executorActionLabel?: string;
  initialTab?: DetailTab;
};

type ModalName =
  | "create-wallet"
  | "fund-wallet"
  | null;

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "agent-access", label: "Agent Access" },
  { id: "results", label: "Reports" },
];

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUnixTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "Not recorded";
  }

  return new Date(timestamp * 1000).toLocaleString();
}

function formatValue(value?: string) {
  if (!value) {
    return "Not set";
  }

  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function summarizeFunding(hasWallet: boolean, isZeroBalance: boolean, isLoading: boolean) {
  if (!hasWallet) {
    return "Wallet not created";
  }

  if (isLoading) {
    return "Checking balance";
  }

  return isZeroBalance ? "Needs funding" : "Funded";
}

function nextStepFor(agent: AgentRecord, funded: boolean) {
  const latestRun = agent.objectiveRuns?.[0];
  const score = latestRun?.benchmarkScore?.finalScore ?? 0;

  if (!agent.walletAddress) {
    return {
      action: "create-wallet" as const,
      button: "Create Smart Wallet",
      title: "Create Smart Wallet",
      tone: "current",
    };
  }

  if (!funded) {
    return {
      action: "fund-wallet" as const,
      button: "Fund Wallet",
      title: "Add funds",
      tone: "current",
    };
  }

  if (!latestRun) {
    return {
      action: "results" as const,
      button: "View Reports",
      title: "Waiting for runner",
      tone: "current",
    };
  }

  if (score >= 70) {
    return {
      action: "results" as const,
      button: "Review Reports",
      title: "Ready",
      tone: "complete",
    };
  }

  return {
    action: "results" as const,
    button: "Review Reports",
    title: "Review Reports",
    tone: "current",
  };
}

function Modal({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label={label}
        className="wallet-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-topline">
          <h2>{label}</h2>
          <button className="secondary-action" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function AgentProfileCard({
  agent,
  connectedAddress,
  executorActionLabel,
  initialTab = "overview",
}: AgentProfileCardProps) {
  const [currentAgent, setCurrentAgent] = useState(agent);
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);
  const [modal, setModal] = useState<ModalName>(null);
  const isOwner =
    connectedAddress?.toLowerCase() === currentAgent.ownerAddress.toLowerCase();
  const isViewOnly = Boolean(connectedAddress && !isOwner);
  const latestRun = currentAgent.objectiveRuns?.[0];
  const agentIdentityId = currentAgent.agentIdentityId ?? currentAgent.id;
  const {
    activity: onchainActivity,
    error: onchainActivityError,
    loading: onchainActivityLoading,
  } = useOnchainRunnerActivity({
    agentId: agentIdentityId,
    walletAddress: currentAgent.walletAddress,
  });
  const { formattedBalance, isLoading, isRefreshing, isStale, isZeroBalance } = useWalletBalance(
    currentAgent.walletAddress,
  );
  const funded = Boolean(
    currentAgent.walletAddress &&
      (currentAgent.walletFundedAt || (!isLoading && !isZeroBalance)),
  );
  const externalDefiEligibility = getExternalDefiEligibility(currentAgent, funded);
  const status = getAgentStatus(currentAgent, funded);
  const hasWallet = Boolean(currentAgent.walletAddress);
  const nextStep = nextStepFor(currentAgent, funded);
  const closeModal = () => setModal(null);
  const latestBenchmarkScore =
    onchainActivity?.latestValidation?.averageScore ??
    latestRun?.benchmarkScore?.finalScore;
  const latestRiskScore =
    onchainActivity?.latestValidation?.riskScore ??
    latestRun?.riskReport?.riskScore;
  const latestPolicyDecision =
    onchainActivity?.latestValidation
      ? onchainActivity.latestValidation.passed
        ? "passed"
        : "failed"
      : latestRun?.riskReport?.policyDecision;

  useEffect(() => {
    setCurrentAgent(agent);
    setActiveTab(initialTab);
  }, [agent, initialTab]);

  useEffect(() => {
    if (!currentAgent.walletAddress || isLoading || isZeroBalance || currentAgent.walletFundedAt) {
      return;
    }

    setCurrentAgent((agentState) => ({
      ...agentState,
      walletFundedAt: new Date().toISOString(),
    }));
  }, [
    currentAgent.walletAddress,
    currentAgent.walletFundedAt,
    isLoading,
    isZeroBalance,
  ]);

  const openNextStep = () => {
    if (nextStep.action === "create-wallet") {
      setModal("create-wallet");
      return;
    }

    if (nextStep.action === "fund-wallet") {
      setModal("fund-wallet");
      return;
    }

    setActiveTab("results");
  };

  return (
    <div className={hasWallet ? "wallet-detail-layout" : "wallet-detail-layout wallet-detail-setup"}>
      <section className="wallet-header-card" aria-label="Smart wallet profile">
        <div className="wallet-title-block">
          <h2>{currentAgent.name}</h2>
          <p>{currentAgent.description ?? currentAgent.goal}</p>
        </div>
        <AgentStatusBadge status={status} />
        <dl className="wallet-header-metrics">
          <div>
            <dt>Smart Wallet</dt>
            <dd>
              {currentAgent.walletAddress
                ? formatAddress(currentAgent.walletAddress)
                : "Not created"}
            </dd>
          </div>
          {hasWallet && (
            <div>
              <dt>Balance</dt>
              <dd>
                {isLoading
                  ? <span className="balance-skeleton" />
                  : <>{formattedBalance}{isRefreshing && <span className="balance-indicator"> checking...</span>}{isStale && !isRefreshing && <span className="balance-indicator balance-stale"> stale</span>}</>}
              </dd>
            </div>
          )}
          <div>
            <dt>Runner</dt>
            <dd>{formatValue(currentAgent.runnerMode ?? "demo")}</dd>
          </div>
          <div>
            <dt>Agent ID</dt>
            <dd>
              {currentAgent.identityStandard === "erc-8004"
                ? `ERC-8004 #${agentIdentityId}`
                : "Legacy"}
            </dd>
          </div>
          <div>
            <dt>Benchmark</dt>
            <dd>{latestBenchmarkScore ?? "—"}</dd>
          </div>
        </dl>
        {onchainActivity?.latestValidation && (
          <span
            className={`status-pill ${onchainActivity.latestValidation.passed ? "status-ready" : "status-blocked"}`}
          >
            {onchainActivity.latestValidation.passed ? "On-chain validated" : "Validation failed"}
          </span>
        )}
        {hasWallet && (
          <div className="wallet-header-actions">
            <button className="primary-action" onClick={openNextStep} type="button">
              {nextStep.button}
            </button>
            <button
              className="secondary-action"
              onClick={() => setActiveTab("agent-access")}
              type="button"
            >
              Agent Access
            </button>
          </div>
        )}
      </section>

      {isViewOnly && (
        <section className="wallet-notice-card" aria-label="View only access">
          <h3>View only</h3>
          <p>Only the owner wallet can edit this smart wallet.</p>
        </section>
      )}

      {!hasWallet && (
        <section className="wallet-setup-hero" aria-label="Next step">
          <div>
            <span className="status-pill status-current">Setup required</span>
            <h3>{currentAgent.walletDeploymentPending ? "Wallet deployment confirming" : "Deploy wallet"}</h3>
            <p>
              {currentAgent.walletDeploymentPending
                ? "The deployment transaction was confirmed. Nexora is waiting for the registry read to return the wallet address."
                : `This creates the dedicated Mantle Sepolia wallet for ${currentAgent.name}. It gets its own address and can only use funds sent to that address.`}
            </p>
          </div>
          <button className="primary-action" onClick={openNextStep} type="button">
            {currentAgent.walletDeploymentPending ? "Check Wallet Address" : "Create Smart Wallet"}
          </button>
        </section>
      )}

      {!hasWallet && (
        <section className="setup-snapshot" aria-label="Wallet setup summary">
          <article>
            <span>Runner</span>
            <strong>{formatValue(currentAgent.runnerMode ?? "demo")}</strong>
          </article>
          <article>
            <span>Owner</span>
            <strong>{formatAddress(currentAgent.ownerAddress)}</strong>
          </article>
        </section>
      )}

      {hasWallet && (
        <nav className="wallet-tab-nav" aria-label="Wallet detail tabs">
          {tabs.map((tab) => (
            <button
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? "wallet-tab-active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {hasWallet && (
        <section className="wallet-tab-panel" aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label} tab`}>
        {activeTab === "overview" && (
          <div className="overview-grid">
            <section className="summary-card">
              <h3>Wallet</h3>
              <dl>
                <div>
                  <dt>Address</dt>
                  <dd>{currentAgent.walletAddress ? formatAddress(currentAgent.walletAddress) : "Not created"}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{formatAddress(currentAgent.ownerAddress)}</dd>
                </div>
                <div>
                  <dt>Balance</dt>
                  <dd>
                    {currentAgent.walletAddress
                      ? isLoading
                        ? <span className="balance-skeleton" />
                        : <>{formattedBalance}{isRefreshing && <span className="balance-indicator"> checking...</span>}{isStale && !isRefreshing && <span className="balance-indicator balance-stale"> stale</span>}</>
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="summary-card">
              <h3>Executor</h3>
              <dl>
                <div>
                  <dt>Runner</dt>
                  <dd>pnpm nexora:runner -- {agentIdentityId}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{currentAgent.autonomy?.enabled ? "Set" : "Not set"}</dd>
                </div>
              </dl>
              <button className="secondary-action" onClick={() => setActiveTab("agent-access")} type="button">
                Manage Agent Access
              </button>
            </section>
            <section className="summary-card">
              <h3>Latest Benchmark</h3>
              <dl>
                <div>
                  <dt>Score</dt>
                  <dd>{latestBenchmarkScore ?? "No benchmark yet"}</dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd>{latestRiskScore !== undefined ? `${latestRiskScore} / 100` : "No risk report yet"}</dd>
                </div>
                <div>
                  <dt>Decision</dt>
                  <dd>{latestPolicyDecision ?? "Pending"}</dd>
                </div>
              </dl>
            </section>
            <section className="summary-card">
              <h3>Status</h3>
              <dl>
                <div>
                  <dt>Funding</dt>
                  <dd>{summarizeFunding(Boolean(currentAgent.walletAddress), isZeroBalance, isLoading)}</dd>
                </div>
                <div>
                  <dt>Balance</dt>
                  <dd>
                    {currentAgent.walletAddress
                      ? isLoading
                        ? <span className="balance-skeleton" />
                        : <>{formattedBalance} · live{isRefreshing && <span className="balance-indicator"> checking...</span>}{isStale && !isRefreshing && <span className="balance-indicator balance-stale"> stale</span>}</>
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Execution</dt>
                  <dd>{onchainActivity?.latestExecution?.status ?? latestRun?.execution?.status ?? "No execution yet"}</dd>
                </div>
                <div>
                  <dt>External DeFi</dt>
                  <dd>{externalDefiEligibility.label}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {activeTab === "agent-access" && (
          <div className="single-panel-grid">
            <AutonomyControls
              agent={currentAgent}
              executorActionLabel={executorActionLabel}
              isOwner={Boolean(isOwner)}
              onSaved={setCurrentAgent}
            />
          </div>
        )}

        {activeTab === "results" && (
          <div className="agent-detail-panel">
            <OnchainAgentReportPanel
              activity={onchainActivity}
              activityError={onchainActivityError}
              activityLoading={onchainActivityLoading}
              agent={currentAgent}
            />
          </div>
        )}
        </section>
      )}

      {modal === "create-wallet" && (
        <Modal label="CreateSmartWalletModal" onClose={closeModal}>
          <AgentWalletCard
            agent={currentAgent}
            isOwner={Boolean(isOwner)}
            onWalletCreated={setCurrentAgent}
          />
        </Modal>
      )}

      {modal === "fund-wallet" && (
        <Modal label="FundWalletModal" onClose={closeModal}>
          <AgentWalletBalance walletAddress={currentAgent.walletAddress} />
          <FundWalletPanel
            walletAddress={currentAgent.walletAddress}
            onFunded={(transactionHash) => {
              setCurrentAgent({
                ...currentAgent,
                walletFundedAt: new Date().toISOString(),
                walletFundingTransactionHash: transactionHash,
              });
            }}
          />
        </Modal>
      )}

    </div>
  );
}
