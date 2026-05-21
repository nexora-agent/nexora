"use client";

import { useCallback, useEffect, useState } from "react";
import { getBalance } from "@wagmi/core";
import { formatEther } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { wagmiConfig } from "@/lib/wagmi/config";

export type WalletBalanceState = {
  balance: string;
  formattedBalance: string;
  isLoading: boolean;
  isZeroBalance: boolean;
  refreshBalance: () => void;
};

export function useWalletBalance(walletAddress?: `0x${string}`): WalletBalanceState {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState("0");
  const [formattedBalance, setFormattedBalance] = useState("0 MNT");

  const refreshBalance = useCallback(() => {
    setIsLoading(true);
    setRefreshNonce((currentNonce) => currentNonce + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    getBalance(wagmiConfig, {
      address: walletAddress,
      chainId: mantleSepolia.id,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const formatted = Number(formatEther(result.value)).toLocaleString(
          "en-US",
          {
            maximumFractionDigits: 6,
          },
        );
        setBalance(result.value.toString());
        setFormattedBalance(`${formatted} ${result.symbol}`);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setBalance("0");
        setFormattedBalance("0 MNT");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshNonce, walletAddress]);

  return {
    balance,
    formattedBalance,
    isLoading,
    isZeroBalance: balance === "0",
    refreshBalance,
  };
}
