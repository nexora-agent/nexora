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

const balanceCacheTtlMs = 60_000;
const balanceCache = new Map<
  string,
  {
    balance: string;
    formattedBalance: string;
    timestamp: number;
  }
>();
const inFlightBalances = new Map<
  string,
  Promise<{
    balance: string;
    formattedBalance: string;
  }>
>();

async function readWalletBalance(walletAddress: `0x${string}`) {
  const cacheKey = walletAddress.toLowerCase();
  const cached = balanceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < balanceCacheTtlMs) {
    return {
      balance: cached.balance,
      formattedBalance: cached.formattedBalance,
    };
  }

  const existingRead = inFlightBalances.get(cacheKey);
  if (existingRead) {
    return existingRead;
  }

  const nextRead = getBalance(wagmiConfig, {
    address: walletAddress,
    chainId: mantleSepolia.id,
  })
    .then((result) => {
      const formatted = Number(formatEther(result.value)).toLocaleString(
        "en-US",
        {
          maximumFractionDigits: 6,
        },
      );
      const resolved = {
        balance: result.value.toString(),
        formattedBalance: `${formatted} ${result.symbol}`,
      };

      balanceCache.set(cacheKey, {
        ...resolved,
        timestamp: Date.now(),
      });

      return resolved;
    })
    .finally(() => {
      inFlightBalances.delete(cacheKey);
    });

  inFlightBalances.set(cacheKey, nextRead);
  return nextRead;
}

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

    readWalletBalance(walletAddress)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setBalance(result.balance);
        setFormattedBalance(result.formattedBalance);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const cached = balanceCache.get(walletAddress.toLowerCase());
        if (cached) {
          setBalance(cached.balance);
          setFormattedBalance(cached.formattedBalance);
        }
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
