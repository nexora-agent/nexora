"use client";

import type { AgentRecord } from "@nexora/shared";
import Link from "next/link";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import {
  AgentStatusBadge,
  getAgentAvailableActions,
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
  isRefreshing,
  isStale,
}: {
  walletAddress?: string;
  formattedBalance?: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
}) {
  if (!walletAddress) {
    return <span>Not created</span>;
  }

  if (isLoading) {
    return <span aria-label="Loading balance" className="value-skeleton" />;
  }

  return (
    <span>
      {formattedBalance ?? "—"}
      {isRefreshing && <span className="balance-indicator"> ↻</span>}
      {isStale && !isRefreshing && (
        <span className="balance-indicator balance-stale"> stale</span>
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
  const { formattedBalance, isLoading, isRefreshing, isStale } = useWalletBalance(
    agent.walletAddress as `0x${string}` | undefined,
  );

  const balanceMnt = parseMntBalance(formattedBalance);

  const status = getAgentStatus(agent, {
    balanceMnt,
    minimumReadyBalanceMnt: MINIMUM_MNT_READY_BALANCE,
  });

  const availableActions = getAgentAvailableActions(agent, status);

  const handleAction = (actionKind: string) => {
    if (actionKind === "fund-wallet") {
      onWalletAction?.(agent, "needs-funding");
      return;
    }

    onWalletAction?.(agent, status);
  };

  return (
    <tr>
      <td>
        <Link className="table-link" href={`/wallets/${agent.id}`}>
          {agent.name}
        </Link>
      </td>

      <td>{getAgentDescription(agent)}</td>

      <td>{formatAddress(agent.walletAddress)}</td>

      <td>
        <WalletBalanceCell
          formattedBalance={formattedBalance}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isStale={isStale}
          walletAddress={agent.walletAddress}
        />
      </td>

      <td>
        <AgentStatusBadge status={status} />
      </td>

      <td>
        <div className="wallet-action-row">
          <button
            className="secondary-action"
            onClick={() => onOpenWallet?.(agent)}
            type="button"
          >
            View
          </button>

          {availableActions.map((action) => (
            <button
              className={action.primary ? "primary-action" : "secondary-action"}
              key={action.kind}
              onClick={() => handleAction(action.kind)}
              type="button"
            >
              {action.label}
            </button>
          ))}
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

  if (agents.length === 0) {
    return (
      <section className="empty-state-card" aria-label="Empty dashboard">
        <h2>Create your first AI-controlled smart wallet.</h2>
        <p>
          Smart wallets appear here after creation. Each wallet can be funded,
          benchmarked, and monitored from this dashboard.
        </p>
        <button
          className="primary-action"
          onClick={onCreateSmartWallet}
          type="button"
        >
          Create Smart Wallet
        </button>
      </section>
    );
  }

  return (
    <section className="agent-table-card" aria-label="Smart wallets table">
      <div className="agent-table-header">
        <div>
          <h2>Smart Wallets</h2>
          <p>{agents.length} wallet{agents.length === 1 ? "" : "s"} created</p>
        </div>

        <button
          className="primary-action"
          onClick={onCreateSmartWallet}
          type="button"
        >
          Create Smart Wallet
        </button>
      </div>

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
            {agents.map((agent) => (
              <AgentTableRow
                agent={agent}
                key={agent.id}
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
