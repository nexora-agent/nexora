"use client";

import { useMemo } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { mantleSepolia } from "@/lib/chains/mantle";

export type WalletReadiness = "disconnected" | "wrong-network" | "ready";

function normalizeWalletError(error: unknown) {
  if (!(error instanceof Error)) {
    return new Error("Wallet action failed.");
  }

  if (
    error.name === "ProviderNotFoundError" ||
    error.message.includes("Provider not found")
  ) {
    return new Error(
      "MetaMask is not available in this browser. Open the app in a browser with the MetaMask extension enabled.",
      { cause: error },
    );
  }

  return error;
}

export function useWalletConnection() {
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const {
    connectAsync,
    connectors,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, error: switchError, isPending: isSwitching } =
    useSwitchChain();

  const readiness: WalletReadiness = useMemo(() => {
    if (!isConnected) {
      return "disconnected";
    }

    if (chainId !== mantleSepolia.id) {
      return "wrong-network";
    }

    return "ready";
  }, [chainId, isConnected]);

  const connectWallet = async () => {
    const [connector] = connectors;
    if (!connector) {
      throw new Error("No injected wallet connector found.");
    }

    try {
      await connectAsync({
        connector,
      });
    } catch (error) {
      throw normalizeWalletError(error);
    }
  };

  const switchToMantle = async () => {
    await switchChainAsync({
      chainId: mantleSepolia.id,
    });
  };

  return {
    address,
    chainId,
    connectError,
    connectWallet,
    disconnectWallet: disconnect,
    isConnected,
    isConnecting,
    isReady: readiness === "ready",
    isSwitching,
    mantleChain: mantleSepolia,
    readiness,
    switchError,
    switchToMantle,
  };
}
