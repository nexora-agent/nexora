"use client";

import { useWalletBalance } from "@/hooks/useWalletBalance";

type AgentWalletBalanceProps = {
  walletAddress?: `0x${string}`;
};

export function AgentWalletBalance({ walletAddress }: AgentWalletBalanceProps) {
  const { formattedBalance, isLoading, isRefreshing, isStale, isZeroBalance, refreshBalance } =
    useWalletBalance(walletAddress);

  return (
    <section className="wallet-balance-panel" aria-label="Smart wallet balance">
      <dl>
        <div>
          <dt>Balance</dt>
          <dd>
            {isLoading ? (
              <span className="balance-skeleton" />
            ) : (
              <>
                {formattedBalance}
                {isRefreshing && <span className="balance-indicator"> checking...</span>}
                {isStale && !isRefreshing && <span className="balance-indicator balance-stale"> stale</span>}
              </>
            )}
          </dd>
        </div>
      </dl>
      <span
        className={
          isZeroBalance
            ? "status-pill status-wrong-network"
            : "status-pill status-ready"
        }
      >
        {isZeroBalance ? "Needs funding" : "Funded"}
      </span>
      <button
        className="secondary-action"
        disabled={!walletAddress || isLoading || isRefreshing}
        onClick={refreshBalance}
        type="button"
      >
        {isRefreshing ? "Checking..." : "Refresh Balance"}
      </button>
    </section>
  );
}
