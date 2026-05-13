"use client";

import { useWalletConnection } from "@/hooks/useWalletConnection";

type ConnectWalletButtonProps = {
  variant?: "primary" | "secondary" | "compact";
};

export function ConnectWalletButton({
  variant = "primary",
}: ConnectWalletButtonProps) {
  const { connectWallet, isConnected, isConnecting } = useWalletConnection();

  if (isConnected) {
    return null;
  }

  const className =
    variant === "secondary"
      ? "secondary-action"
      : variant === "compact"
        ? "wallet-button"
        : "primary-action";

  return (
    <button
      className={className}
      disabled={isConnecting}
      onClick={() => void connectWallet()}
      type="button"
    >
      {isConnecting ? "Connecting..." : "Connect MetaMask"}
    </button>
  );
}
