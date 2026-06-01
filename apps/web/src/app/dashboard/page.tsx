"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { AgentCreationWizard } from "@/components/agent/AgentCreationWizard";
import { AgentList } from "@/components/agent/AgentList";
import { AgentProfileCard } from "@/components/agent/AgentProfileCard";
import { BenchmarkBuilder } from "@/components/benchmark/BenchmarkBuilder";
import { getAgentStatus } from "@/components/agent/AgentStatusBadge";
import { AgentWalletBalance } from "@/components/wallet/AgentWalletBalance";
import { AgentWalletCard } from "@/components/wallet/AgentWalletCard";
import { AgentConfigurationPanel } from "@/components/runner/AgentConfigurationPanel";
import { FundWalletPanel } from "@/components/wallet/FundWalletPanel";
import { useAgents } from "@/hooks/useAgents";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import type { AgentRecord } from "@nexora/shared";
import type { AgentStatus } from "@/components/agent/AgentStatusBadge";

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
  const [activeView, setActiveView] = useState<"wallets" | "agent-config">("wallets");
  const [modal, setModal] = useState<DashboardModal>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | undefined>();
  const totalWallets = agents.length;
  const needsFunding = agents.filter(
    (agent) => getAgentStatus(agent) === "needs-funding",
  ).length;
  const benchmarkedAgents = agents.filter((agent) => agent.objectiveRuns?.[0]);
  const averageBenchmark =
    benchmarkedAgents.length > 0
      ? Math.round(
          benchmarkedAgents.reduce(
            (total, agent) =>
              total + (agent.objectiveRuns?.[0]?.benchmarkScore?.finalScore ?? 0),
            0,
          ) / benchmarkedAgents.length,
        )
      : "—";
  const activeWallets = agents.filter(
    (agent) => getAgentStatus(agent) === "active",
  ).length;
  const closeModal = () => {
    setModal(null);
    setSelectedAgent(undefined);
    void refreshAgents();
  };
  const openWalletDetail = (agent: AgentRecord) => {
    setSelectedAgent(agent);
    setModal("wallet-detail");
  };
  const openWalletAction = (
    agent: AgentRecord,
    statusOverride?: AgentStatus,
  ) => {
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

  return (
    <main>
      <Header />
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
            <div className="dashboard-hero-actions">
              <button className="primary-action" onClick={() => setModal("smart-wallet")} type="button">
                Create Smart Wallet
              </button>
              <button className="secondary-action" onClick={() => setActiveView("agent-config")} type="button">
                Agent Configuration
              </button>
            </div>
          </section>

          <div className="dashboard-view-tabs" aria-label="Dashboard views">
            <button
              className={activeView === "wallets" ? "dashboard-view-tab-active" : ""}
              onClick={() => setActiveView("wallets")}
              type="button"
            >
              Smart Wallets
            </button>
            <button
              className={activeView === "agent-config" ? "dashboard-view-tab-active" : ""}
              onClick={() => setActiveView("agent-config")}
              type="button"
            >
              Agent Configuration
            </button>
          </div>

          {activeView === "wallets" ? (
            <>
              <section className="dashboard-action-strip" aria-label="Dashboard actions">
                <div>
                  <strong>Benchmarks</strong>
                  <span>Create a custom benchmark and store its hash on Mantle.</span>
                </div>
                <button className="secondary-action" onClick={() => setModal("benchmark")} type="button">
                  Create Benchmark
                </button>
              </section>

              <section className="dashboard-summary-grid" aria-label="Dashboard summary">
                <article>
                  <span>Total Smart Wallets</span>
                  <strong>{loaded ? totalWallets : "—"}</strong>
                </article>
                <article>
                  <span>Needs Funding</span>
                  <strong>{loaded ? needsFunding : "—"}</strong>
                </article>
                <article>
                  <span>Average Benchmark</span>
                  <strong>{loaded ? averageBenchmark : "—"}</strong>
                </article>
                <article>
                  <span>Active Wallets</span>
                  <strong>{loaded ? activeWallets : "—"}</strong>
                </article>
              </section>

              <AgentList
                agents={agents}
                onCreateSmartWallet={() => setModal("smart-wallet")}
                onOpenWallet={openWalletDetail}
                onWalletAction={openWalletAction}
              />
            </>
          ) : (
            <AgentConfigurationPanel agents={agents} />
          )}
        </div>
      </section>

      {modal === "smart-wallet" && (
        <DashboardModalShell label="Create Smart Wallet" onClose={closeModal}>
          <AgentCreationWizard />
        </DashboardModalShell>
      )}

      {modal === "benchmark" && (
        <DashboardModalShell label="Create Benchmark" onClose={closeModal}>
          <BenchmarkBuilder />
        </DashboardModalShell>
      )}

      {modal === "wallet-detail" && selectedAgent && (
        <DashboardModalShell label={selectedAgent.name} onClose={closeModal}>
          <AgentProfileCard agent={selectedAgent} connectedAddress={address} />
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
