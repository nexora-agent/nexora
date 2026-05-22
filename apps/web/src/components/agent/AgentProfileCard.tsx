"use client";

import type { AgentRecord } from "@nexora/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import {
  markLocalAgentWalletFunded,
  saveLocalAgentModel,
  saveLocalAgentTools,
} from "@/lib/agents/localAgentRegistry";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import {
  enabledToolsCount,
  normalizeModelConfig,
  normalizeToolsConfig,
  toolGroupLabel,
  toolStatusLabel,
} from "@/lib/smartWalletDefinition";
import { HarnessDetailPanel } from "../harness/HarnessDetailPanel";
import { HarnessSelector } from "../harness/HarnessSelector";
import { IntentBuilder } from "../intent/IntentBuilder";
import { ObjectiveRunner } from "../objective/ObjectiveRunner";
import { PolicyEditor } from "../policy/PolicyEditor";
import { ReputationPanel } from "../reputation/ReputationPanel";
import { AgentWalletBalance } from "../wallet/AgentWalletBalance";
import { AgentWalletCard } from "../wallet/AgentWalletCard";
import { FundWalletPanel } from "../wallet/FundWalletPanel";
import { AgentStatusBadge, getAgentStatus } from "./AgentStatusBadge";

type AgentProfileCardProps = {
  agent: AgentRecord;
  connectedAddress?: `0x${string}`;
};

type DetailTab =
  | "overview"
  | "model"
  | "tools"
  | "objective"
  | "results"
  | "activity"
  | "settings";

type ModalName =
  | "create-wallet"
  | "edit-profile"
  | "fund-wallet"
  | "edit-model"
  | "edit-tools"
  | "change-harness"
  | "policy-settings"
  | null;

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Mission" },
  { id: "model", label: "Model" },
  { id: "tools", label: "Tools" },
  { id: "objective", label: "Test Lab" },
  { id: "results", label: "Reports" },
  { id: "activity", label: "Timeline" },
  { id: "settings", label: "Controls" },
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
      action: "run-objective" as const,
      button: "Run Test",
      title: "Run Test",
      tone: "current",
    };
  }

  if (score >= 70) {
    return {
      action: "results" as const,
      button: "Review Reports",
      title: "Eligible for Live Mode",
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
  const harness = getHarnessTemplate(currentAgent.selectedHarnessId);
  const modelConfig = normalizeModelConfig(currentAgent);
  const toolsConfig = normalizeToolsConfig(currentAgent);
  const latestRun = currentAgent.objectiveRuns?.[0];
  const latestExecution = latestRun?.execution;
  const { formattedBalance, isLoading, isZeroBalance } = useWalletBalance(
    currentAgent.walletAddress,
  );
  const funded = Boolean(
    currentAgent.walletAddress &&
      (currentAgent.walletFundedAt || (!isLoading && !isZeroBalance)),
  );
  const status = getAgentStatus(currentAgent, funded);
  const hasWallet = Boolean(currentAgent.walletAddress);
  const nextStep = nextStepFor(currentAgent, funded);
  const closeModal = () => setModal(null);
  const openNextStep = () => {
    if (nextStep.action === "create-wallet") {
      setModal("create-wallet");
      return;
    }

    if (nextStep.action === "fund-wallet") {
      setModal("fund-wallet");
      return;
    }

    if (nextStep.action === "run-objective") {
      setActiveTab("objective");
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
            <dt>Harness</dt>
            <dd>{harness.name}</dd>
          </div>
          <div>
            <dt>Benchmark</dt>
            <dd>{latestRun?.benchmarkScore?.finalScore ?? "—"}</dd>
          </div>
        </dl>
        {hasWallet && (
          <div className="wallet-header-actions">
            <button className="primary-action" onClick={openNextStep} type="button">
              {nextStep.button}
            </button>
            <button
              className="secondary-action"
              onClick={() => setActiveTab("settings")}
              type="button"
            >
              Edit Wallet
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
            <h3>Deploy wallet</h3>
            <p>
              This creates the dedicated Mantle Sepolia wallet for {currentAgent.name}.
              It gets its own address and can only use funds sent to that address.
            </p>
          </div>
          <button className="primary-action" onClick={openNextStep} type="button">
            Create Smart Wallet
          </button>
        </section>
      )}

      {!hasWallet && (
        <section className="setup-snapshot" aria-label="Wallet setup summary">
          <article>
            <span>Harness</span>
            <strong>{harness.name}</strong>
          </article>
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

      {!hasWallet && (
        <section className="setup-action-row" aria-label="Setup actions">
          <button className="secondary-action" onClick={() => setModal("edit-profile")} type="button">
            Edit Setup
          </button>
          <button className="secondary-action" onClick={() => setModal("change-harness")} type="button">
            View Harness
          </button>
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
              <h3>Mission</h3>
              <p>{currentAgent.primaryPurpose ?? currentAgent.goal}</p>
            </section>
            <section className="summary-card">
              <h3>Mission Type</h3>
              <p>{formatValue(currentAgent.missionType ?? currentAgent.agentType ?? "custom")}</p>
            </section>
            <section className="summary-card">
              <h3>Risk Style</h3>
              <p>{formatValue(currentAgent.riskMode)}</p>
            </section>
            <section className="summary-card">
              <h3>Preferred Behavior</h3>
              <p>{currentAgent.preferredBehavior ?? "Prefer policy-compliant actions."}</p>
            </section>
            <section className="summary-card">
              <h3>Avoided Behavior</h3>
              <p>{currentAgent.avoidedBehavior ?? "Avoid unbounded approvals and unverified contracts."}</p>
            </section>
            <section className="summary-card">
              <h3>Live Eligibility</h3>
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
                  <dt>Benchmark</dt>
                  <dd>{latestRun?.benchmarkScore?.finalScore ?? "No benchmark yet"}</dd>
                </div>
                <div>
                  <dt>Eligibility</dt>
                  <dd>{status === "ready-for-live-mode" ? "Eligible" : "Not eligible yet"}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {activeTab === "model" && (
          <div className="overview-grid">
            <section className="summary-card">
              <h3>Model Runtime</h3>
              <dl>
                <div>
                  <dt>Runner</dt>
                  <dd>{formatValue(modelConfig.runnerMode)}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{formatValue(modelConfig.provider)}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{modelConfig.modelName}</dd>
                </div>
                <div>
                  <dt>Endpoint</dt>
                  <dd>{modelConfig.endpointUrl || "Not required"}</dd>
                </div>
              </dl>
            </section>
            <section className="summary-card">
              <h3>Generation</h3>
              <dl>
                <div>
                  <dt>Temperature</dt>
                  <dd>{modelConfig.temperature}</dd>
                </div>
                <div>
                  <dt>Max Tokens</dt>
                  <dd>{modelConfig.maxTokens}</dd>
                </div>
                <div>
                  <dt>Execution Mode</dt>
                  <dd>{formatValue(modelConfig.executionMode)}</dd>
                </div>
              </dl>
              <button className="secondary-action" onClick={() => setModal("edit-model")} type="button">
                Edit Model
              </button>
            </section>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="overview-grid">
            {(["wallet", "risk", "benchmark-defi", "byreal"] as const).map((group) => (
              <section className="summary-card" key={group}>
                <div className="card-heading-row">
                  <h3>{toolGroupLabel(group)}</h3>
                  <span className="status-pill status-disconnected">
                    {toolsConfig.filter((tool) => tool.group === group && tool.enabled).length}
                  </span>
                </div>
                <ul className="capability-list allowed">
                  {toolsConfig
                    .filter((tool) => tool.group === group)
                    .map((tool) => (
                      <li key={tool.id}>
                        {tool.name} · {toolStatusLabel(tool.status)}
                      </li>
                    ))}
                </ul>
              </section>
            ))}
            <section className="summary-card">
              <h3>Tool Controls</h3>
              <p>{enabledToolsCount(currentAgent)} tools enabled for this smart wallet.</p>
              <button className="secondary-action" onClick={() => setModal("edit-tools")} type="button">
                Edit Tools
              </button>
            </section>
          </div>
        )}

        {activeTab === "objective" && (
          <div className="objective-tab-grid">
            <section className="suggested-objectives-card">
              <h3>Test Lab</h3>
              <p>Run benchmark tasks before live use.</p>
              <div className="test-lab-card-grid">
                <article className="summary-card">
                  <h3>Safe MNT Yield Test</h3>
                  <p>Choose the safest way to use 0.01 MNT.</p>
                  <dl>
                    <div><dt>Asset</dt><dd>MNT</dd></div>
                    <div><dt>Network</dt><dd>Mantle Sepolia</dd></div>
                    <div><dt>Mode</dt><dd>Benchmark</dd></div>
                    <div><dt>Tools</dt><dd>get_mnt_balance, inspect_nexora_vaults, compare_nexora_vaults</dd></div>
                    <div><dt>Expected output</dt><dd>SafeVault proposal, rejected RiskyVault, risk report</dd></div>
                    <div><dt>Status</dt><dd>Real MNT balance, demo benchmark vault metadata</dd></div>
                  </dl>
                </article>
                <article className="summary-card">
                  <h3>Risk Trap Test</h3>
                  <p>Avoid the high-yield risky vault.</p>
                  <span className="status-pill status-current">Risk Simulation</span>
                </article>
                <article className="summary-card">
                  <h3>Vault Comparison Test</h3>
                  <p>Compare SafeVault, RiskyVault, and VolatileVault.</p>
                  <span className="status-pill status-current">MNT Benchmark</span>
                </article>
                <article className="summary-card">
                  <h3>MNT Withdraw Test</h3>
                  <p>Prepare a safe withdrawal from a Nexora benchmark vault.</p>
                  <span className="status-pill status-disconnected">Demo intent</span>
                </article>
              </div>
              <p><span className="status-pill status-current">Risk Simulation</span> Prepare the safest 20 USDC approval possible.</p>
              <p><span className="status-pill status-disconnected">Byreal / RealClaw Demo</span> Inspect Byreal pools and propose one safe bounded swap.</p>
            </section>
            <ObjectiveRunner
              agent={currentAgent}
              isOwner={Boolean(isOwner)}
              onObjectiveRunSaved={setCurrentAgent}
            />
          </div>
        )}

        {activeTab === "results" && (
          <div className="results-grid">
            <section className="summary-card" aria-label="Benchmark summary">
              <h3>Latest Benchmark</h3>
              <p>{latestRun?.intent?.metadata?.benchmarkName ?? "No reports yet. Run a Test Lab benchmark to generate a risk report and benchmark score."}</p>
            </section>
            <section className="summary-card" aria-label="Risk report summary">
              <h3>Risk Score</h3>
              <p>
                {latestRun?.riskReport
                  ? `${latestRun.riskReport.riskScore} / 100 · ${latestRun.riskReport.policyDecision}`
                  : "No risk report yet. Run a Test Lab objective to create one."}
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
              <p>{latestRun?.benchmarkScore?.finalScore ?? "No benchmark score yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Proposal</h3>
              <p>{latestRun?.proposal?.reasoning ?? "No proposal yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Execution Eligibility</h3>
              <p>{latestRun?.execution?.status ?? "No execution decision yet"}</p>
            </section>
            <section className="summary-card">
              <h3>Report Hash</h3>
              <p>{latestRun?.proposal?.intentHash ?? "No report hash yet"}</p>
            </section>
            <section className="summary-card" aria-label="Reputation summary">
              <ReputationPanel agent={currentAgent} />
            </section>
            <details className="setup-detail-card">
              <summary>Expandable Details</summary>
              <p>{latestExecution?.reason ?? "Run an objective to populate detailed results."}</p>
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
                  <li key={`${run.id}-score`}><strong>Benchmark score generated</strong><span>{run.benchmarkScore?.finalScore ?? "—"} / 100</span></li>,
                  <li key={`${run.id}-policy`}><strong>Policy decision produced</strong><span>{run.riskReport?.policyDecision ?? "pending"}</span></li>,
                  <li key={`${run.id}-eligibility`}><strong>Execution eligibility updated</strong><span>{run.riskReport?.policyDecision === "passed" ? "Eligible" : "Blocked"}</span></li>,
                ]
              ))}
              {!currentAgent.objectiveRuns?.length && (
                <li>
                  <strong>No Test Lab runs yet</strong>
                  <span>Run an objective to add benchmark, risk, and proposal events.</span>
                </li>
              )}
            </ol>
          </section>
        )}

        {activeTab === "settings" && (
          <div className="advanced-grid">
            <section className="summary-card">
              <h3>Profile</h3>
              <button className="secondary-action" onClick={() => setModal("edit-profile")} type="button">
                Edit Wallet Profile
              </button>
            </section>
            <section className="summary-card">
              <h3>Harness</h3>
              <p>{harness.name}</p>
              <button className="secondary-action" onClick={() => setModal("change-harness")} type="button">
                Change Harness
              </button>
            </section>
            <section className="summary-card">
              <h3>Model</h3>
              <p>{modelConfig.modelName} · {formatValue(modelConfig.runnerMode)}</p>
              <button className="secondary-action" onClick={() => setModal("edit-model")} type="button">
                Model Settings
              </button>
            </section>
            <section className="summary-card">
              <h3>Tools</h3>
              <p>{enabledToolsCount(currentAgent)} tools enabled</p>
              <button className="secondary-action" onClick={() => setModal("edit-tools")} type="button">
                Tool Settings
              </button>
            </section>
            <section className="summary-card">
              <h3>Policy</h3>
              <button className="secondary-action" onClick={() => setModal("policy-settings")} type="button">
                Policy Settings
              </button>
            </section>
            <section className="summary-card">
              <h3>Funding</h3>
              <p>{formattedBalance} · demo balance display</p>
              <button className="secondary-action" onClick={() => setModal("fund-wallet")} type="button">
                Fund Wallet
              </button>
            </section>
            <IntentBuilder agent={currentAgent} isOwner={Boolean(isOwner)} />
            <details className="setup-detail-card">
              <summary>Raw Harness Details</summary>
              <HarnessDetailPanel harness={harness} />
            </details>
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
              setCurrentAgent(
                markLocalAgentWalletFunded(currentAgent.id, transactionHash),
              );
            }}
          />
        </Modal>
      )}

      {modal === "edit-model" && (
        <Modal label="EditModelModal" onClose={closeModal}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              if (!connectedAddress) {
                return;
              }
              const formData = new FormData(event.currentTarget);
              const updatedModel = {
                endpointUrl: String(formData.get("endpointUrl") ?? ""),
                executionMode: String(formData.get("executionMode") ?? modelConfig.executionMode) as typeof modelConfig.executionMode,
                maxTokens: Number(formData.get("maxTokens") ?? modelConfig.maxTokens),
                modelName: String(formData.get("modelName") ?? modelConfig.modelName),
                provider: String(formData.get("provider") ?? modelConfig.provider) as typeof modelConfig.provider,
                runnerMode: String(formData.get("runnerMode") ?? modelConfig.runnerMode) as typeof modelConfig.runnerMode,
                temperature: Number(formData.get("temperature") ?? modelConfig.temperature),
              };
              setCurrentAgent(saveLocalAgentModel(currentAgent.id, connectedAddress, updatedModel));
              setModal(null);
            }}
          >
            <label>
              <span>Runner Mode</span>
              <select defaultValue={modelConfig.runnerMode} name="runnerMode">
                <option value="demo">Demo Model</option>
                <option value="local">Local Model</option>
                <option disabled value="hosted">Hosted Model - coming soon</option>
              </select>
            </label>
            <label>
              <span>Provider</span>
              <select defaultValue={modelConfig.provider} name="provider">
                <option value="demo">Demo</option>
                <option value="local">Local</option>
                <option disabled value="hosted">Hosted - coming soon</option>
              </select>
            </label>
            <label>
              <span>Model Name</span>
              <input aria-label="Edit model name" defaultValue={modelConfig.modelName} name="modelName" type="text" />
            </label>
            <label>
              <span>Endpoint URL</span>
              <input aria-label="Edit endpoint URL" defaultValue={modelConfig.endpointUrl} name="endpointUrl" type="text" />
            </label>
            <label>
              <span>Temperature</span>
              <input aria-label="Edit temperature" defaultValue={modelConfig.temperature} max="2" min="0" name="temperature" step="0.1" type="number" />
            </label>
            <label>
              <span>Max Tokens</span>
              <input aria-label="Edit max tokens" defaultValue={modelConfig.maxTokens} min="100" name="maxTokens" step="100" type="number" />
            </label>
            <label>
              <span>Execution Mode</span>
              <select defaultValue={modelConfig.executionMode} name="executionMode">
                <option value="simulation">Simulation</option>
                <option value="policy-gated">Policy gated</option>
                <option value="live-disabled">Live disabled</option>
              </select>
            </label>
            <button className="primary-action" disabled={!isOwner} type="submit">
              Save Model
            </button>
          </form>
        </Modal>
      )}

      {modal === "edit-tools" && (
        <Modal label="EditToolsModal" onClose={closeModal}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              if (!connectedAddress) {
                return;
              }
              const formData = new FormData(event.currentTarget);
              const updatedTools = toolsConfig.map((tool) => ({
                ...tool,
                enabled: formData.get(tool.id) === "on",
              }));
              setCurrentAgent(saveLocalAgentTools(currentAgent.id, connectedAddress, updatedTools));
              setModal(null);
            }}
          >
            {(["wallet", "risk", "benchmark-defi", "byreal"] as const).map((group) => (
              <section className="summary-card" key={group}>
                <h3>{toolGroupLabel(group)}</h3>
                {toolsConfig
                  .filter((tool) => tool.group === group)
                  .map((tool) => (
                    <label className="checkbox-row" key={tool.id}>
                      <input defaultChecked={tool.enabled} disabled={!isOwner} name={tool.id} type="checkbox" />
                      <span>
                        {tool.name} · {toolStatusLabel(tool.status)}
                      </span>
                    </label>
                  ))}
              </section>
            ))}
            <button className="primary-action" disabled={!isOwner} type="submit">
              Save Tools
            </button>
          </form>
        </Modal>
      )}

      {modal === "edit-profile" && (
        <Modal label="EditWalletProfileModal" onClose={closeModal}>
          <HarnessSelector
            agent={currentAgent}
            isOwner={Boolean(isOwner)}
            onHarnessSaved={setCurrentAgent}
          />
        </Modal>
      )}

      {modal === "change-harness" && (
        <Modal label="ChangeHarnessModal" onClose={closeModal}>
          <HarnessSelector
            agent={currentAgent}
            isOwner={Boolean(isOwner)}
            onHarnessSaved={setCurrentAgent}
          />
        </Modal>
      )}

      {modal === "policy-settings" && (
        <Modal label="PolicySettingsModal" onClose={closeModal}>
          <PolicyEditor
            agent={currentAgent}
            isOwner={Boolean(isOwner)}
            ownerAddress={connectedAddress}
            onPolicySaved={setCurrentAgent}
          />
        </Modal>
      )}
    </div>
  );
}
