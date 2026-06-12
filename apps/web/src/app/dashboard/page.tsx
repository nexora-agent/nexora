"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { HostedPreviewBanner } from "@/components/HostedPreviewBanner";
import { HostedBenchmarkPreview } from "@/components/demo/HostedBenchmarkPreview";
import { RecordedMantleProofs } from "@/components/demo/RecordedMantleProofs";
import { isHostedPreviewMode } from "@/lib/demo/demoMode";
import { AgentCreationWizard } from "@/components/agent/AgentCreationWizard";
import { AgentList } from "@/components/agent/AgentList";
import { AgentProfileCard } from "@/components/agent/AgentProfileCard";
import { BenchmarkBuilder } from "@/components/benchmark/BenchmarkBuilder";
import { BenchmarkDashboard } from "@/components/benchmark/BenchmarkDashboard";
import { getAgentStatus } from "@/components/agent/AgentStatusBadge";
import { AgentWalletBalance } from "@/components/wallet/AgentWalletBalance";
import { AgentWalletCard } from "@/components/wallet/AgentWalletCard";
import { AgentConfigurationPanel } from "@/components/runner/AgentConfigurationPanel";
import { FundWalletPanel } from "@/components/wallet/FundWalletPanel";
import { WalletCharacter } from "@/components/WalletCharacter";
import { useAgents } from "@/hooks/useAgents";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import type { AgentRecord } from "@nexora/shared";
import type { AgentStatus } from "@/components/agent/AgentStatusBadge";

type ActiveView = "wallets" | "agent-config" | "benchmarks";
type WalletDetailIntent = "default" | "renew-executor" | "select-benchmark";

type DashboardModal =
  | "smart-wallet"
  | "benchmark"
  | "wallet-detail"
  | "create-agent-wallet"
  | "fund-wallet"
  | null;

function DashboardModalShell({
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
        className="wallet-modal dashboard-modal"
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

export default function DashboardPage() {
  const { agents, loaded, refreshAgents } = useAgents();
  const { address } = useWalletConnection();
  const [activeView, setActiveView] = useState<ActiveView>("wallets");
  const [benchmarkRefreshKey, setBenchmarkRefreshKey] = useState(0);
  const [modal, setModal] = useState<DashboardModal>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | undefined>();
  const [walletDetailIntent, setWalletDetailIntent] =
    useState<WalletDetailIntent>("default");
  const [configAgentId, setConfigAgentId] = useState<string | undefined>();

  const closeModal = () => {
    setModal(null);
    setSelectedAgent(undefined);
    setWalletDetailIntent("default");
    void refreshAgents();
  };

  const openWalletDetail = (agent: AgentRecord) => {
    setSelectedAgent(agent);
    setWalletDetailIntent("default");
    setModal("wallet-detail");
  };

  const openRenewExecutor = (agent: AgentRecord) => {
    setSelectedAgent(agent);
    setWalletDetailIntent("renew-executor");
    setModal("wallet-detail");
  };

  const openSelectBenchmark = (agent: AgentRecord) => {
    setSelectedAgent(agent);
    setWalletDetailIntent("select-benchmark");
    setModal("wallet-detail");
  };

  const useWalletInAgentConfig = (agent: AgentRecord) => {
    setConfigAgentId(agent.agentIdentityId ?? agent.id);
    setActiveView("agent-config");
  };

  const openWalletAction = (agent: AgentRecord, statusOverride?: AgentStatus) => {
    setSelectedAgent(agent);
    const status = statusOverride ?? getAgentStatus(agent);

    if (status === "needs-wallet") {
      setModal("create-agent-wallet");
      return;
    }

    if (status === "needs-funding") {
      setModal("fund-wallet");
      return;
    }

    window.location.href = `/wallets/${agent.id}`;
  };

  const handleBenchmarkCreated = () => {
    setActiveView("benchmarks");
    setBenchmarkRefreshKey((value) => value + 1);
    setModal(null);
    setSelectedAgent(undefined);
  };

  const handleSmartWalletCreated = () => {
    setActiveView("wallets");
    setModal(null);
    setSelectedAgent(undefined);
    void refreshAgents();
  };

  const hostedPreview = isHostedPreviewMode();

  return (
    <main>
      <Header />
      <HostedPreviewBanner />
      <section className="page-shell">
        <div className="dashboard-container" data-testid="dashboard-container">
          <section className="dashboard-hero" aria-label="Dashboard overview">
            <div>
              <h1>Nexora Smart Wallets</h1>
              <p>
                Create AI-controlled smart wallets, run policy-gated objectives,
                and benchmark every on-chain action before it reaches live funds.
              </p>
            </div>
            <div className="dashboard-hero-character">
              <WalletCharacter size={110} />
            </div>
          </section>

          <div className="dashboard-view-tabs" aria-label="Dashboard views">
            <button
              className={activeView === "wallets" ? "dashboard-view-tab-active" : ""}
              onClick={() => setActiveView("wallets")}
              type="button"
            >
              <strong>Smart Wallets</strong>
              <span>Wallets, balances, and status</span>
            </button>
            <button
              className={activeView === "agent-config" ? "dashboard-view-tab-active" : ""}
              onClick={() => setActiveView("agent-config")}
              type="button"
            >
              <strong>Agent Configuration</strong>
              <span>Model, runner, and tools</span>
            </button>
            <button
              className={activeView === "benchmarks" ? "dashboard-view-tab-active" : ""}
              onClick={() => setActiveView("benchmarks")}
              type="button"
            >
              <strong>Benchmarks</strong>
              <span>Custom tests and gates</span>
            </button>
          </div>

          {activeView === "wallets" && (
            <AgentList
              agents={agents}
              isLoading={!loaded}
              onCreateSmartWallet={() => setModal("smart-wallet")}
              onOpenWallet={openWalletDetail}
              onRenewExecutor={openRenewExecutor}
              onSelectBenchmark={openSelectBenchmark}
              onUseWallet={useWalletInAgentConfig}
              onWalletAction={openWalletAction}
            />
          )}

          {activeView === "agent-config" &&
            (hostedPreview ? (
              <HostedBenchmarkPreview />
            ) : (
              <AgentConfigurationPanel
                agents={agents}
                initialAgentId={configAgentId}
              />
            ))}

          {activeView === "benchmarks" && (
            <BenchmarkDashboard
              connectedAddress={address}
              onCreateBenchmark={() => setModal("benchmark")}
              refreshKey={benchmarkRefreshKey}
            />
          )}

          {hostedPreview && <RecordedMantleProofs />}
        </div>
      </section>

      {modal === "smart-wallet" && (
        <DashboardModalShell label="Create Smart Wallet" onClose={closeModal}>
          <AgentCreationWizard onComplete={handleSmartWalletCreated} />
        </DashboardModalShell>
      )}

      {modal === "benchmark" && (
        <DashboardModalShell label="Create Benchmark" onClose={closeModal}>
          <BenchmarkBuilder onCreated={handleBenchmarkCreated} />
        </DashboardModalShell>
      )}

      {modal === "wallet-detail" && selectedAgent && (
        <DashboardModalShell label={selectedAgent.name} onClose={closeModal}>
          <AgentProfileCard
            agent={selectedAgent}
            connectedAddress={address}
            executorActionLabel={
              walletDetailIntent === "renew-executor"
                ? "Renew Executor"
                : undefined
            }
            initialTab={
              walletDetailIntent !== "default"
                ? "agent-access"
                : "overview"
            }
          />
        </DashboardModalShell>
      )}

      {modal === "create-agent-wallet" && selectedAgent && (
        <DashboardModalShell label="Create Agent Wallet" onClose={closeModal}>
          <AgentWalletCard
            agent={selectedAgent}
            isOwner={Boolean(
              address &&
                address.toLowerCase() === selectedAgent.ownerAddress.toLowerCase(),
            )}
            onWalletCreated={(updatedAgent) => {
              setSelectedAgent(updatedAgent);
              void refreshAgents();
            }}
          />
        </DashboardModalShell>
      )}

      {modal === "fund-wallet" && selectedAgent && (
        <DashboardModalShell label="FundWalletModal" onClose={closeModal}>
          <AgentWalletBalance walletAddress={selectedAgent.walletAddress} />
          <FundWalletPanel
            walletAddress={selectedAgent.walletAddress}
            onFunded={(transactionHash) => {
              const updatedAgent = {
                ...selectedAgent,
                walletFundedAt: new Date().toISOString(),
                walletFundingTransactionHash: transactionHash,
              };
              setSelectedAgent(updatedAgent);
              void refreshAgents();
            }}
          />
        </DashboardModalShell>
      )}
    </main>
  );
}
