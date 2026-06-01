"use client";

import { buildReportEnvelope, type AgentRecord } from "@nexora/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useOnchainRunnerActivity } from "@/hooks/useOnchainRunnerActivity";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { getByrealStatus } from "@/lib/byreal/byrealAdapter";
import { fetchByrealStatus } from "@/lib/byreal/byrealClient";
import {
  getExternalDefiEligibility,
  latestByrealRun,
} from "@/lib/byreal/externalDefiEligibility";
import { ModelDecisionPanel } from "../benchmark/ModelDecisionPanel";
import { ByrealStatusCard } from "../byreal/ByrealStatusCard";
import { ReputationPanel } from "../reputation/ReputationPanel";
import { AgentWalletBalance } from "../wallet/AgentWalletBalance";
import { AgentWalletCard } from "../wallet/AgentWalletCard";
import { FundWalletPanel } from "../wallet/FundWalletPanel";
import { AgentStatusBadge, getAgentStatus } from "./AgentStatusBadge";
import { AutonomyControls } from "./AutonomyControls";

type AgentProfileCardProps = {
  agent: AgentRecord;
  connectedAddress?: `0x${string}`;
};

type DetailTab =
  | "overview"
  | "agent-access"
  | "results"
  | "activity";

type ModalName =
  | "create-wallet"
  | "fund-wallet"
  | null;

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "agent-access", label: "Agent Access" },
  { id: "results", label: "Reports" },
  { id: "activity", label: "Timeline" },
];

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
}: AgentProfileCardProps) {
  const [currentAgent, setCurrentAgent] = useState(agent);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
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
    refresh: refreshOnchainActivity,
  } = useOnchainRunnerActivity({
    agentId: agentIdentityId,
    walletAddress: currentAgent.walletAddress,
  });
  const latestReportEnvelope = latestRun
    ? (latestRun.reportEnvelope ?? buildReportEnvelope(latestRun))
    : undefined;
  const [byrealStatus, setByrealStatus] = useState(getByrealStatus);
  const latestByrealProposalRun = latestByrealRun(currentAgent);
  const latestExecution = latestRun?.execution;
  const { formattedBalance, isLoading, isZeroBalance } = useWalletBalance(
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
    let active = true;

    void fetchByrealStatus().then((statusResult) => {
      if (active) {
        setByrealStatus(statusResult);
      }
    });

    return () => {
      active = false;
    };
  }, []);

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
              <dd>{isLoading ? "Checking" : formattedBalance}</dd>
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
                  <dd>{currentAgent.walletAddress ? formattedBalance : "—"}</dd>
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
                  <dd>{currentAgent.walletAddress ? `${formattedBalance} · live balance` : "—"}</dd>
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
              isOwner={Boolean(isOwner)}
              onSaved={setCurrentAgent}
            />
          </div>
        )}

        {activeTab === "results" && (
          <div className="results-grid">
            {onchainActivity?.latestValidation && (
              <section className="summary-card onchain-runner-report" aria-label="On-chain runner report">
                <div className="card-heading-row">
                  <h3>On-chain Runner Report</h3>
                  <button className="ghost-action" onClick={() => void refreshOnchainActivity()} type="button">
                    Refresh
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Average Score</dt>
                    <dd>{onchainActivity.latestValidation.averageScore}</dd>
                  </div>
                  <div>
                    <dt>Basic / Trap / External</dt>
                    <dd>
                      {onchainActivity.latestValidation.basicScore} /{" "}
                      {onchainActivity.latestValidation.adversarialScore} /{" "}
                      {onchainActivity.latestValidation.externalScore}
                    </dd>
                  </div>
                  <div>
                    <dt>Risk</dt>
                    <dd>{onchainActivity.latestValidation.riskScore} / 100</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{onchainActivity.latestValidation.passed ? "Passed" : "Failed"}</dd>
                  </div>
                  <div>
                    <dt>Report Hash</dt>
                    <dd>{onchainActivity.latestValidation.reportHash}</dd>
                  </div>
                  <div>
                    <dt>Action Intent</dt>
                    <dd>{onchainActivity.latestValidation.actionIntentHash}</dd>
                  </div>
                  <div>
                    <dt>Validation Tx</dt>
                    <dd>{onchainActivity.latestValidation.txHash ?? "Not found in recent logs"}</dd>
                  </div>
                  <div>
                    <dt>Execution</dt>
                    <dd>
                      {onchainActivity.latestExecution
                        ? `${onchainActivity.latestExecution.status ?? "unknown"} · ${onchainActivity.latestExecution.txHash ?? "no tx"}`
                        : "No matching execution found"}
                    </dd>
                  </div>
                  <div>
                    <dt>SafeVault Position</dt>
                    <dd>{onchainActivity.safeVaultPosition?.balanceMnt ?? "No SafeVault position"}</dd>
                  </div>
                </dl>
              </section>
            )}
            {!onchainActivity?.latestValidation && (
              <section className="summary-card">
                <div className="card-heading-row">
                  <h3>On-chain Runner Report</h3>
                  <button className="ghost-action" onClick={() => void refreshOnchainActivity()} type="button">
                    Refresh
                  </button>
                </div>
                <p>
                  {onchainActivityLoading
                    ? "Reading Mantle..."
                    : onchainActivityError ?? "No on-chain runner validation found yet."}
                </p>
              </section>
            )}
            <section className="summary-card" aria-label="Benchmark summary">
              <h3>Latest Benchmark</h3>
              <p>{latestRun?.intent?.metadata?.benchmarkName ?? "No reports yet. Start the local runner to generate benchmark and risk records."}</p>
            </section>
            <section className="summary-card" aria-label="Risk report summary">
              <h3>Risk Score</h3>
              <p>
                {latestRun?.riskReport
                  ? `${latestRun.riskReport.riskScore} / 100 · ${latestRun.riskReport.policyDecision}`
                  : onchainActivity?.latestValidation
                    ? `${onchainActivity.latestValidation.riskScore} / 100 · ${onchainActivity.latestValidation.passed ? "passed" : "failed"}`
                    : "No risk report yet. Start the local runner to create one."}
              </p>
            </section>
            <section className="summary-card">
              <h3>Selected Vault</h3>
              <p>{latestRun?.intent?.metadata?.targetVault ?? "No vault selected yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Rejected Vaults</h3>
              <p>{latestRun?.intent?.metadata?.rejectedOptions?.map((vault) => `${vault.name}: ${vault.reason}`).join(" · ") ?? "No rejected vaults yet"}</p>
            </section>
            <section className="summary-card">
              <h3>MNT Amount</h3>
              <p>{latestRun?.intent?.tokenSymbol === "MNT" ? `${latestRun.intent.amount} MNT` : "No MNT benchmark yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Benchmark Score</h3>
              <p>{latestBenchmarkScore ?? "No benchmark score yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Proposal</h3>
              <p>{latestRun?.proposal?.reasoning ?? "No proposal yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Execution Eligibility</h3>
              <p>{onchainActivity?.latestExecution?.status ?? latestRun?.execution?.status ?? "No execution decision yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Report Hash</h3>
              <p>{onchainActivity?.latestValidation?.reportHash ?? latestReportEnvelope?.reportHash ?? "No report hash yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Tool Trace Hash</h3>
              <p>{latestReportEnvelope?.toolTraceHash ?? "No tool trace hash yet"}</p>
            </section>
            <section className="summary-card">
              <h3>External DeFi Eligibility</h3>
              <p>{externalDefiEligibility.label}</p>
              <span>{externalDefiEligibility.reason}</span>
            </section>
            <ByrealStatusCard
              eligibilityLabel={externalDefiEligibility.label}
              eligibilityReason={externalDefiEligibility.reason}
              status={byrealStatus}
            />
            <section className="summary-card">
              <h3>Latest Byreal Proposal</h3>
              <p>{latestByrealProposalRun?.proposal?.poolName ?? "No Byreal proposal yet"}</p>
              <span>{latestByrealProposalRun ? "External DeFi Preview" : "External DeFi Preview proposals appear here."}</span>
            </section>
            <section className="summary-card">
              <h3>Execution Mode</h3>
              <p>{latestByrealProposalRun ? "External DeFi Preview" : "No External DeFi Preview yet"}</p>
            </section>
            <section className="summary-card" aria-label="Reputation summary">
              {onchainActivity?.reputation ? (
                <>
                  <h3>On-chain Reputation</h3>
                  <dl>
                    <div>
                      <dt>Trust Score</dt>
                      <dd>{onchainActivity.reputation.trustScore ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Benchmark Runs</dt>
                      <dd>{onchainActivity.reputation.benchmarkRuns ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Safe Actions</dt>
                      <dd>{onchainActivity.reputation.safeActions ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Blocked Actions</dt>
                      <dd>{onchainActivity.reputation.blockedActions ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Policy Violations</dt>
                      <dd>{onchainActivity.reputation.policyViolations ?? 0}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <ReputationPanel agent={currentAgent} />
              )}
            </section>
            <details className="setup-detail-card">
              <summary>Model and Tool Logs</summary>
              {latestRun ? (
                <>
                  <ModelDecisionPanel intent={latestRun.intent} />
                  <section className="summary-card">
                    <h3>Tool Trace</h3>
                    <ol className="tool-trace-list">
                      {latestRun.toolTrace.map((tool) => (
                        <li key={`${latestRun.id}-${tool.index}`}>
                          <strong>{tool.toolName}</strong>
                          <span>{tool.summary}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                  {latestExecution?.reason && (
                    <section className="summary-card">
                      <h3>Execution</h3>
                      <p>{latestExecution.reason}</p>
                    </section>
                  )}
                </>
              ) : (
                <p>Start the local runner to populate detailed results.</p>
              )}
            </details>
          </div>
        )}

        {activeTab === "activity" && (
          <section className="activity-timeline" aria-label="Wallet activity timeline">
            <ol>
              <li>
                <strong>Profile created</strong>
                <span>{currentAgent.createdAt}</span>
              </li>
              {onchainActivity?.latestValidation && (
                <li>
                  <strong>On-chain validation recorded</strong>
                  <span>
                    Score {onchainActivity.latestValidation.averageScore} · risk{" "}
                    {onchainActivity.latestValidation.riskScore} ·{" "}
                    {onchainActivity.latestValidation.txHash ?? "tx not found"}
                  </span>
                </li>
              )}
              {onchainActivity?.latestExecution && (
                <li>
                  <strong>Wallet execution recorded</strong>
                  <span>
                    {onchainActivity.latestExecution.status} ·{" "}
                    {onchainActivity.latestExecution.value ?? "value unavailable"} ·{" "}
                    {onchainActivity.latestExecution.txHash ?? "tx not found"}
                  </span>
                </li>
              )}
              {onchainActivity?.safeVaultPosition && (
                <li>
                  <strong>SafeVault position</strong>
                  <span>{onchainActivity.safeVaultPosition.balanceMnt}</span>
                </li>
              )}
              {currentAgent.walletAddress && (
                <li>
                  <strong>Smart wallet deployed</strong>
                  <span>{formatAddress(currentAgent.walletAddress)}</span>
                </li>
              )}
              {(currentAgent.objectiveRuns ?? []).map((run) => (
                [
                  <li key={`${run.id}-started`}><strong>Benchmark started</strong><span>{run.intent?.metadata?.benchmarkName ?? run.objective}</span></li>,
                  ...run.toolTrace.map((tool) => (
                    <li key={`${run.id}-${tool.index}`}><strong>Tool called: {tool.toolName}</strong><span>{tool.summary}</span></li>
                  )),
                  <li key={`${run.id}-proposal`}><strong>Proposal created</strong><span>{run.proposal?.targetVault ?? run.proposal?.actionType ?? "Proposal"}</span></li>,
                  <li key={`${run.id}-risk`}><strong>Risk report generated</strong><span>{run.riskReport?.riskScore ?? "—"} / 100</span></li>,
                  ...(run.intent?.kind.startsWith("byreal_")
                    ? [
                        <li key={`${run.id}-byreal-status`}><strong>Byreal status checked</strong><span>{run.intent.metadata?.mode ?? "demo"} mode; live execution disabled</span></li>,
                        <li key={`${run.id}-byreal-pools`}><strong>Byreal pools listed</strong><span>External DeFi opportunities inspected</span></li>,
                        <li key={`${run.id}-byreal-inspected`}><strong>Byreal opportunity inspected</strong><span>{run.intent.metadata?.poolName ?? "Byreal / RealClaw opportunity"}</span></li>,
                        <li key={`${run.id}-byreal-proposal`}><strong>Byreal proposal created</strong><span>External DeFi Preview</span></li>,
                        <li key={`${run.id}-byreal-risk`}><strong>Byreal risk report generated</strong><span>{run.riskReport?.riskScore ?? "—"} / 100</span></li>,
                        <li key={`${run.id}-byreal-eligibility`}><strong>External DeFi eligibility checked</strong><span>{externalDefiEligibility.label}</span></li>,
                      ]
                    : []),
                  <li key={`${run.id}-score`}><strong>Benchmark score generated</strong><span>{run.benchmarkScore?.finalScore ?? "—"} / 100</span></li>,
                  <li key={`${run.id}-policy`}><strong>Policy decision produced</strong><span>{run.riskReport?.policyDecision ?? "pending"}</span></li>,
                  <li key={`${run.id}-eligibility`}><strong>Execution eligibility updated</strong><span>{run.riskReport?.policyDecision === "passed" ? "Eligible" : "Blocked"}</span></li>,
                ]
              ))}
              {!currentAgent.objectiveRuns?.length && !onchainActivity?.latestValidation && (
                <li>
                  <strong>No runner activity yet</strong>
                  <span>Start the local runner to add benchmark, risk, and execution events.</span>
                </li>
              )}
            </ol>
          </section>
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
