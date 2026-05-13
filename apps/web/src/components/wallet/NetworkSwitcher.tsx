"use client";

import { useWalletConnection } from "@/hooks/useWalletConnection";

export function NetworkSwitcher() {
  const { isConnected, isSwitching, readiness, switchToMantle } =
    useWalletConnection();

  if (!isConnected || readiness !== "wrong-network") {
    return null;
  }

  return (
    <div className="network-switcher" role="status">
      <p>Wrong network detected. Switch to Mantle Sepolia to continue.</p>
      <button
        className="primary-action"
        disabled={isSwitching}
        onClick={() => void switchToMantle()}
        type="button"
      >
        {isSwitching ? "Switching..." : "Switch to Mantle"}
      </button>
    </div>
  );
}
