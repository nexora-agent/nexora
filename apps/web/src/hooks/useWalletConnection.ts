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

    await connectAsync({
      connector,
    });
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
