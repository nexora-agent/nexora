"use client";

import type { AgentRecord } from "@nexora/shared";
import Link from "next/link";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import {
  AgentStatusBadge,
  getAgentNextAction,
  getAgentStatus,
  MINIMUM_MNT_READY_BALANCE,
} from "./AgentStatusBadge";

type AgentListProps = {
  agents: AgentRecord[];
  isLoading?: boolean;
  onCreateSmartWallet?: () => void;
  onOpenWallet?: (agent: AgentRecord) => void;
  onWalletAction?: (
    agent: AgentRecord,
    status: ReturnType<typeof getAgentStatus>,
  ) => void;
};

function formatAddress(address?: string) {
  return address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not created";
}

function getAgentDescription(agent: AgentRecord) {
  return agent.description ?? agent.primaryPurpose ?? agent.goal ?? "—";
}

function parseMntBalance(formattedBalance?: string | null) {
  if (!formattedBalance) {
    return null;
  }

  const normalizedBalance = formattedBalance.replaceAll(",", "").trim();
  const balanceMatch = normalizedBalance.match(/-?\d+(\.\d+)?/);

  if (!balanceMatch) {
    return null;
  }

  const parsedBalance = Number(balanceMatch[0]);

  return Number.isFinite(parsedBalance) ? parsedBalance : null;
}

function WalletBalanceCell({
  walletAddress,
  formattedBalance,
  isLoading,
}: {
  walletAddress?: string;
  formattedBalance?: string;
  isLoading: boolean;
}) {
  if (!walletAddress) {
    return <span>Not created</span>;
  }

  return (
    <span>
      {isLoading ? (
        <span aria-label="Loading balance" className="value-skeleton" />
      ) : (
        formattedBalance ?? "—"
      )}
    </span>
  );
}

export function AgentListSkeleton() {
  return (
    <section className="agent-table-card" aria-label="Loading smart wallets">
      <div className="agent-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Address</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 4 }).map((_, index) => (
              <tr key={index}>
                <td>
                  <span className="skeleton-line skeleton-short" />
                </td>
                <td>
                  <span className="skeleton-line" />
                </td>
                <td>
                  <span className="skeleton-line skeleton-short" />
                </td>
                <td>
                  <span className="value-skeleton" />
                </td>
                <td>
                  <span className="skeleton-line skeleton-short" />
                </td>
                <td>
                  <span className="skeleton-line skeleton-short" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AgentTableRow({
  agent,
  onOpenWallet,
  onWalletAction,
}: {
  agent: AgentRecord;
  onOpenWallet?: (agent: AgentRecord) => void;
  onWalletAction?: (
    agent: AgentRecord,
    status: ReturnType<typeof getAgentStatus>,
  ) => void;
}) {
  const { formattedBalance, isLoading } = useWalletBalance(
    agent.walletAddress as `0x${string}` | undefined,
  );

  const balanceMnt = parseMntBalance(formattedBalance);

  const status = getAgentStatus(agent, {
    balanceMnt,
    minimumReadyBalanceMnt: MINIMUM_MNT_READY_BALANCE,
  });

  const nextAction = getAgentNextAction(status);
  const isActionDisabled = Boolean(agent.walletAddress && isLoading);

  async function copyWalletAddress() {
    if (!agent.walletAddress) {
      return;
    }

    await navigator.clipboard.writeText(agent.walletAddress);
  }

  return (
    <tr>
      <td>
        <strong>{agent.name}</strong>
      </td>

      <td>
        <span>{getAgentDescription(agent)}</span>
      </td>

      <td>
        <div className="address-cell">
          <span title={agent.walletAddress ?? undefined}>
            {formatAddress(agent.walletAddress)}
          </span>

          {agent.walletAddress && (
            <button
              aria-label="Copy full wallet address"
              className="secondary-action table-action"
              onClick={copyWalletAddress}
              title="Copy full wallet address"
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                viewBox="0 0 24 24"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  height="13"
                  rx="2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  width="13"
                  x="9"
                  y="9"
                />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          )}
        </div>
      </td>

      <td>
        <WalletBalanceCell
          walletAddress={agent.walletAddress}
          formattedBalance={formattedBalance}
          isLoading={isLoading}
        />
      </td>

      <td>
        {isLoading && agent.walletAddress ? (
          <span aria-label="Loading status" className="skeleton-line skeleton-short" />
        ) : (
          <AgentStatusBadge status={status} />
        )}
      </td>

      <td>
        <div className="table-action-group">
          {onWalletAction && (
            <button
              className="primary-action table-action"
              disabled={isActionDisabled}
              onClick={() => onWalletAction(agent, status)}
              type="button"
            >
              {isActionDisabled ? (
                <span aria-label="Loading action" className="value-skeleton" />
              ) : (
                nextAction
              )}
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
            <Link
              className="secondary-action table-action"
              href={`/wallets/${agent.id}`}
            >
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
  isLoading = false,
  onCreateSmartWallet,
  onOpenWallet,
  onWalletAction,
}: AgentListProps) {
  if (isLoading) {
    return <AgentListSkeleton />;
  }

  const uniqueAgents = agents.filter((agent, index, allAgents) => {
    const identityKey = `${agent.identityStandard ?? "legacy"}-${agent.id}`;
    const walletKey = agent.walletAddress?.toLowerCase();

    return (
      allAgents.findIndex((candidate) => {
        const candidateIdentityKey = `${
          candidate.identityStandard ?? "legacy"
        }-${candidate.id}`;
        const candidateWalletKey = candidate.walletAddress?.toLowerCase();

        return (
          candidateIdentityKey === identityKey ||
          Boolean(walletKey && candidateWalletKey === walletKey)
        );
      }) === index
    );
  });

  if (uniqueAgents.length === 0) {
    return (
      <section className="empty-state-card" aria-label="Empty dashboard">
        <h2>Create your first AI-controlled smart wallet.</h2>

        {onCreateSmartWallet ? (
          <button
            className="primary-action"
            onClick={onCreateSmartWallet}
            type="button"
          >
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
              <th>Name</th>
              <th>Description</th>
              <th>Address</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {uniqueAgents.map((agent, index) => (
              <AgentTableRow
                agent={agent}
                key={`${agent.identityStandard ?? "legacy"}-${agent.id}-${
                  agent.walletAddress ?? "profile"
                }-${index}`}
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