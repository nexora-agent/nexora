"use client";

import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";

type ConnectWalletButtonProps = {
  variant?: "primary" | "secondary" | "compact";
};

export function ConnectWalletButton({
  variant = "primary",
}: ConnectWalletButtonProps) {
  const { connectWallet, isConnected } = useWalletConnection();
  const [isPending, setIsPending] = useState(false);

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
      disabled={isPending}
      onClick={() => {
        setIsPending(true);
        void connectWallet().finally(() => setIsPending(false));
      }}
      type="button"
    >
      {isPending ? "Connecting..." : "Connect MetaMask"}
    </button>
  );
}
