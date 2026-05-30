"use client";

import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";

type ConnectWalletButtonProps = {
  variant?: "primary" | "secondary" | "compact";
};

export function ConnectWalletButton({
  variant = "primary",
}: ConnectWalletButtonProps) {
  const {
    address,
    connectWallet,
    disconnectWallet,
    isConnected,
    isReady,
    readiness,
    switchToMantle,
  } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if (isConnected) {
    return (
      <div className="header-wallet-control" aria-label="Connected wallet">
        <span className={`status-dot status-dot-${readiness}`} />
        <span>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"}</span>
        {!isReady && (
          <button onClick={() => void switchToMantle()} type="button">
            Switch
          </button>
        )}
        <button onClick={() => disconnectWallet()} type="button">
          Disconnect
        </button>
        {errorMessage && <p className="ownership-note">{errorMessage}</p>}
      </div>
    );
  }

  const className =
    variant === "secondary"
      ? "secondary-action"
      : variant === "compact"
        ? "wallet-button"
        : "primary-action";

  return (
    <>
      <button
        className={className}
        disabled={isPending}
        onClick={() => {
          setErrorMessage("");
          setIsPending(true);
          void connectWallet()
            .catch((error: unknown) => {
              setErrorMessage(
                error instanceof Error ? error.message : "Wallet action failed.",
              );
            })
            .finally(() => setIsPending(false));
        }}
        type="button"
      >
        {isPending ? "Connecting..." : "Connect MetaMask"}
      </button>
      {errorMessage && <p className="ownership-note">{errorMessage}</p>}
    </>
  );
}
