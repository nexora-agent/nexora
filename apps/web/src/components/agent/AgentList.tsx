"use client";

import type { AgentRecord } from "@nexora/shared";
import Link from "next/link";
import { getExternalDefiEligibility } from "@/lib/byreal/externalDefiEligibility";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import {
  enabledToolsCount,
  normalizeModelConfig,
} from "@/lib/smartWalletDefinition";
import {
  AgentStatusBadge,
  getAgentNextAction,
  getAgentStatus,
} from "./AgentStatusBadge";

type AgentListProps = {
  agents: AgentRecord[];
  onCreateSmartWallet?: () => void;
  onOpenWallet?: (agent: AgentRecord) => void;
  onWalletAction?: (agent: AgentRecord, status: ReturnType<typeof getAgentStatus>) => void;
};

function formatAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not created";
}

function AgentTableRow({
  agent,
  onOpenWallet,
  onWalletAction,
}: {
  agent: AgentRecord;
  onOpenWallet?: (agent: AgentRecord) => void;
  onWalletAction?: (agent: AgentRecord, status: ReturnType<typeof getAgentStatus>) => void;
}) {
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const modelConfig = normalizeModelConfig(agent);
  const isFunded = Boolean(agent.walletAddress && agent.walletFundedAt);
  const status = getAgentStatus(agent, isFunded);
  const nextAction = getAgentNextAction(status);
  const externalDefi = getExternalDefiEligibility(agent, isFunded);
  const benchmarkScore = agent.objectiveRuns?.[0]?.benchmarkScore?.finalScore;

  return (
    <tr>
      <td>
        <strong>{agent.name}</strong>
        <span>{formatAddress(agent.walletAddress)}</span>
        <span>
          {agent.identityStandard === "erc-8004"
            ? `ERC-8004 #${agent.agentIdentityId ?? agent.id}`
            : "Legacy"}
        </span>
      </td>
      <td>
        <strong>{agent.primaryPurpose ?? agent.description ?? agent.goal}</strong>
        <span>{harness.name}</span>
      </td>
      <td>{modelConfig.modelName}</td>
      <td>{enabledToolsCount(agent)}</td>
      <td>{agent.riskMode}</td>
      <td>{agent.walletAddress ? (agent.walletFundedAt ? "Funded" : "Open wallet") : "—"}</td>
      <td>{benchmarkScore ?? "—"}</td>
      <td>
        <AgentStatusBadge status={status} />
      </td>
      <td>
        <span className={`status-pill ${agent.identityStandard === "erc-8004" ? "status-ready" : "status-disconnected"}`}>
          {agent.identityStandard === "erc-8004" ? "Local runner" : "Legacy"}
        </span>
      </td>
      <td>
        <span className={`status-pill ${externalDefi.status === "dry-run" ? "status-ready" : "status-disconnected"}`}>
          {externalDefi.status === "dry-run" ? "Preview enabled" : "Locked"}
        </span>
      </td>
      <td>
        <div className="table-action-group">
          {onWalletAction && (
            <button
              className="primary-action table-action"
              onClick={() => onWalletAction(agent, status)}
              type="button"
            >
              {nextAction}
            </button>
          )}
          {onOpenWallet ? (
            <button
              className="secondary-action table-action"
              onClick={() => onOpenWallet(agent)}
              type="button"
            >
              View
            </button>
          ) : (
            <Link className="secondary-action table-action" href={`/wallets/${agent.id}`}>
              View
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

export function AgentList({
  agents,
  onCreateSmartWallet,
  onOpenWallet,
  onWalletAction,
}: AgentListProps) {
  const uniqueAgents = agents.filter((agent, index, allAgents) => {
    const identityKey = `${agent.identityStandard ?? "legacy"}-${agent.id}`;
    const walletKey = agent.walletAddress?.toLowerCase();

    return (
      allAgents.findIndex((candidate) => {
        const candidateIdentityKey = `${candidate.identityStandard ?? "legacy"}-${candidate.id}`;
        const candidateWalletKey = candidate.walletAddress?.toLowerCase();

        return candidateIdentityKey === identityKey || Boolean(walletKey && candidateWalletKey === walletKey);
      }) === index
    );
  });

  if (uniqueAgents.length === 0) {
    return (
      <section className="empty-state-card" aria-label="Empty dashboard">
        <h2>Create your first AI-controlled smart wallet.</h2>
        {onCreateSmartWallet ? (
          <button className="primary-action" onClick={onCreateSmartWallet} type="button">
            Create Smart Wallet
          </button>
        ) : (
          <Link className="primary-action" href="/create-wallet">
            Create Smart Wallet
          </Link>
        )}
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
              <th>Mission</th>
              <th>Model</th>
              <th>Tools</th>
              <th>Policy</th>
              <th>Balance</th>
              <th>Benchmark</th>
              <th>Status</th>
              <th>Autonomy</th>
              <th>External DeFi</th>
              <th>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {uniqueAgents.map((agent, index) => (
              <AgentTableRow
                agent={agent}
                key={`${agent.identityStandard ?? "legacy"}-${agent.id}-${agent.walletAddress ?? "profile"}-${index}`}
                onOpenWallet={onOpenWallet}
                onWalletAction={onWalletAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
