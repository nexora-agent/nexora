"use client";

import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";

type ConnectWalletButtonProps = {
  variant?: "primary" | "secondary" | "compact";
};

export function ConnectWalletButton({
  variant = "primary",
}: ConnectWalletButtonProps) {
  const { connectWallet, isConnected } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

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
