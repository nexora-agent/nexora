"use client";

import { injected } from "@wagmi/core";
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
  const { connectAsync, error: connectError } = useConnect();
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
    await connectAsync({
      connector: injected(),
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
