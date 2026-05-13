"use client";

import { useWalletConnection } from "@/hooks/useWalletConnection";
import { NetworkSwitcher } from "./NetworkSwitcher";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusLabel(readiness: string) {
  if (readiness === "ready") {
    return "Ready";
  }

  if (readiness === "wrong-network") {
    return "Switch network";
  }

  return "Disconnected";
}

export function OwnerWalletCard() {
  const {
    address,
    chainId,
    connectError,
    disconnectWallet,
    isConnected,
    mantleChain,
    readiness,
    switchError,
  } = useWalletConnection();

  return (
    <section className="owner-wallet-card" aria-label="Owner wallet status">
      <div className="console-topline">
        <span>Owner wallet</span>
        <span className={`status-pill status-${readiness}`}>
          {statusLabel(readiness)}
        </span>
      </div>

      <dl>
        <div>
          <dt>Owner wallet</dt>
          <dd>{address ? formatAddress(address) : "Not connected"}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>
            {!isConnected
              ? "Not connected"
              : readiness === "ready"
                ? mantleChain.name
                : `Chain ${chainId}`}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(readiness)}</dd>
        </div>
      </dl>

      <NetworkSwitcher />

      {(connectError || switchError) && (
        <p className="error-text">
          {(connectError ?? switchError)?.message ?? "Wallet action failed."}
        </p>
      )}

      {isConnected && (
        <button
          className="secondary-action wallet-disconnect"
          onClick={() => disconnectWallet()}
          type="button"
        >
          Disconnect
        </button>
      )}
    </section>
  );
}
