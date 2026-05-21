"use client";

import { useWalletBalance } from "@/hooks/useWalletBalance";

type AgentWalletBalanceProps = {
  walletAddress?: `0x${string}`;
};

export function AgentWalletBalance({ walletAddress }: AgentWalletBalanceProps) {
  const { formattedBalance, isLoading, isZeroBalance, refreshBalance } =
    useWalletBalance(walletAddress);

  return (
    <section className="wallet-balance-panel" aria-label="Smart wallet balance">
      <dl>
        <div>
          <dt>Balance</dt>
          <dd>{isLoading ? "Refreshing..." : formattedBalance}</dd>
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
        disabled={!walletAddress || isLoading}
        onClick={refreshBalance}
        type="button"
      >
        Refresh Balance
      </button>
    </section>
  );
}
