"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBalance } from "@wagmi/core";
import { formatEther } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { wagmiConfig } from "@/lib/wagmi/config";

export type WalletBalanceState = {
  balance: string;
  formattedBalance: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  isZeroBalance: boolean;
  error: string | null;
  refreshBalance: () => void;
};

const REFRESH_INTERVAL_MS = 20_000;
const CACHE_TTL_MS = 10_000;

const balanceCache = new Map<
  string,
  { balance: string; formattedBalance: string; timestamp: number }
>();
const inFlightBalances = new Map<
  string,
  Promise<{ balance: string; formattedBalance: string }>
>();

async function fetchWalletBalance(walletAddress: `0x${string}`, force: boolean) {
  const cacheKey = walletAddress.toLowerCase();

  if (!force) {
    const cached = balanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { balance: cached.balance, formattedBalance: cached.formattedBalance };
    }
  }

  const existing = inFlightBalances.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = getBalance(wagmiConfig, {
    address: walletAddress,
    chainId: mantleSepolia.id,
  })
    .then((result) => {
      const formatted = Number(formatEther(result.value)).toLocaleString("en-US", {
        maximumFractionDigits: 6,
      });
      const resolved = {
        balance: result.value.toString(),
        formattedBalance: `${formatted} ${result.symbol}`,
      };
      balanceCache.set(cacheKey, { ...resolved, timestamp: Date.now() });
      return resolved;
    })
    .finally(() => {
      inFlightBalances.delete(cacheKey);
    });

  inFlightBalances.set(cacheKey, promise);
  return promise;
}

export function useWalletBalance(walletAddress?: `0x${string}`): WalletBalanceState {
  const [balance, setBalance] = useState("0");
  const [formattedBalance, setFormattedBalance] = useState("0 MNT");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDataRef = useRef(false);
  const walletAddressRef = useRef(walletAddress);
  walletAddressRef.current = walletAddress;

  const doFetch = useCallback(async (force: boolean) => {
    const addr = walletAddressRef.current;
    if (!addr) return;

    if (hasDataRef.current) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await fetchWalletBalance(addr, force);
      setBalance(result.balance);
      setFormattedBalance(result.formattedBalance);
      setError(null);
      setIsStale(false);
      hasDataRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read balance");
      setIsStale(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshBalance = useCallback(() => {
    void doFetch(true);
  }, [doFetch]);

  // Initial load (and re-load when address changes)
  useEffect(() => {
    if (!walletAddress) return;
    hasDataRef.current = false;
    void doFetch(false);
  }, [walletAddress, doFetch]);

  // Auto-refresh every 20 seconds
  useEffect(() => {
    if (!walletAddress) return;
    const id = setInterval(() => void doFetch(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [walletAddress, doFetch]);

  // Refresh when window regains focus
  useEffect(() => {
    const onFocus = () => void doFetch(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [doFetch]);

  // Refresh on funding/creation events
  useEffect(() => {
    const onEvent = () => void doFetch(true);
    window.addEventListener("nexora:wallet-balance-refresh", onEvent);
    return () => window.removeEventListener("nexora:wallet-balance-refresh", onEvent);
  }, [doFetch]);

  return {
    balance,
    formattedBalance,
    isLoading,
    isRefreshing,
    isStale,
    isZeroBalance: balance === "0",
    error,
    refreshBalance,
  };
}
