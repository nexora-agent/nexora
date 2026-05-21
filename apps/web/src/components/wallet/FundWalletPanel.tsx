"use client";

import { useState } from "react";
import { mantleSepolia } from "@/lib/chains/mantle";
import { fundSmartWallet } from "@/lib/contracts/fundSmartWallet";
import { CopyAddressButton } from "./CopyAddressButton";

type FundWalletPanelProps = {
  walletAddress?: `0x${string}`;
};

export function FundWalletPanel({ walletAddress }: FundWalletPanelProps) {
  const [amount, setAmount] = useState("0.05");
  const [error, setError] = useState("");
  const [isFunding, setIsFunding] = useState(false);
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>();

  const fundWallet = async () => {
    if (!walletAddress) {
      return;
    }

    setError("");
    setIsFunding(true);

    try {
      const hash = await fundSmartWallet(walletAddress, amount);
      setTransactionHash(hash);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not fund smart wallet.",
      );
    } finally {
      setIsFunding(false);
    }
  };

  if (!walletAddress) {
    return (
      <section className="fund-wallet-panel" aria-label="Fund smart wallet panel">
        <h3>Funding</h3>
      </section>
    );
  }

  return (
    <section className="fund-wallet-panel" aria-label="Fund smart wallet panel">
      <h3>Funding</h3>
      <dl>
        <div>
          <dt>Network</dt>
          <dd>{mantleSepolia.name}</dd>
        </div>
        <div>
          <dt>Funding Address</dt>
          <dd>{walletAddress}</dd>
        </div>
      </dl>
      <div className="funding-actions">
        <label>
          <span>Amount</span>
          <input
            aria-label="Funding amount"
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
        </label>
        <button
          className="primary-action"
          disabled={isFunding || !amount || Number(amount) <= 0}
          onClick={() => void fundWallet()}
          type="button"
        >
          {isFunding ? "Funding..." : "Fund Smart Wallet"}
        </button>
        <CopyAddressButton address={walletAddress} />
      </div>
      {transactionHash && (
        <p className="success-text">
          Funding transaction {transactionHash.slice(0, 10)}...
          {transactionHash.slice(-6)}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
