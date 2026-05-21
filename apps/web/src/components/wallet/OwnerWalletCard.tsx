"use client";

import { useEffect, useState } from "react";
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
  const [isMounted, setIsMounted] = useState(false);
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
  const displayReadiness = isMounted ? readiness : "disconnected";
  const displayIsConnected = isMounted ? isConnected : false;
  const displayAddress = isMounted ? address : undefined;
  const displayChainId = isMounted ? chainId : undefined;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <section className="owner-wallet-card" aria-label="Owner wallet status">
      <div className="console-topline">
        <span>Owner wallet</span>
        <span className={`status-pill status-${displayReadiness}`}>
          {statusLabel(displayReadiness)}
        </span>
      </div>

      <dl>
        <div>
          <dt>Owner wallet</dt>
          <dd>{displayAddress ? formatAddress(displayAddress) : "Not connected"}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>
            {!displayIsConnected
              ? "Not connected"
              : displayReadiness === "ready"
                ? mantleChain.name
                : `Chain ${displayChainId}`}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(displayReadiness)}</dd>
        </div>
      </dl>

      {isMounted && <NetworkSwitcher />}

      {isMounted && (connectError || switchError) && (
        <p className="error-text">
          {(connectError ?? switchError)?.message ?? "Wallet action failed."}
        </p>
      )}

      {displayIsConnected && (
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
