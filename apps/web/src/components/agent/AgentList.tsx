import type { AgentRecord } from "@nexora/shared";
import Link from "next/link";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { AgentStatusBadge, getAgentStatus } from "./AgentStatusBadge";

type AgentListProps = {
  agents: AgentRecord[];
  loaded: boolean;
};

function formatAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not created";
}

function formatValue(value?: string) {
  if (!value) {
    return "—";
  }

  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function AgentList({ agents, loaded }: AgentListProps) {
  if (!loaded) {
    return (
      <section className="empty-state-card" aria-label="Loading smart wallets">
        <h2>Loading smart wallets</h2>
      </section>
    );
  }

  if (agents.length === 0) {
    return (
      <section className="empty-state-card" aria-label="Empty dashboard">
        <h2>Create your first smart wallet</h2>
        <Link className="primary-action" href="/create-wallet">
          Create Smart Wallet
        </Link>
      </section>
    );
  }

  return (
    <section className="agent-table-card" aria-label="Smart wallets table">
      <div className="agent-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Smart Wallet</th>
              <th>Type</th>
              <th>Harness</th>
              <th>Runner</th>
              <th>Address</th>
              <th>Balance</th>
              <th>Benchmark Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const harness = getHarnessTemplate(agent.selectedHarnessId);
              const status = getAgentStatus(agent);

              return (
                <tr key={agent.id}>
                  <td>
                    <strong>{agent.name}</strong>
                  </td>
                  <td>{formatValue(agent.agentType)}</td>
                  <td>{harness.name}</td>
                  <td>{formatValue(agent.runnerMode ?? "demo")}</td>
                  <td>{formatAddress(agent.walletAddress)}</td>
                  <td>{agent.walletAddress ? "0 MNT" : "—"}</td>
                  <td>{agent.objectiveRuns?.[0]?.benchmarkScore?.finalScore ?? "—"}</td>
                  <td>
                    <AgentStatusBadge status={status} />
                  </td>
                  <td>
                    <Link className="secondary-action" href={`/wallets/${agent.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
