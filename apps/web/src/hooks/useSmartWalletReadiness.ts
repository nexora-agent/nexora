"use client";

import type { AgentRecord } from "@nexora/shared";
import { useEffect, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import { MINIMUM_MNT_READY_BALANCE } from "@/components/agent/AgentStatusBadge";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { readAutonomyStateOnchain } from "@/lib/contracts/onchainAutonomy";
import { readActiveBenchmarkForAgent } from "@/lib/contracts/onchainBenchmarks";

export type SmartWalletMissingRequirement = "funding" | "benchmark" | "executor";

export type SmartWalletReadiness =
  | { status: "loading" }
  | { status: "wallet-missing" }
  | { status: "setup-missing"; missing: SmartWalletMissingRequirement[] }
  | { status: "executor-expired" }
  | { status: "ready" };

type OnchainChecks = {
  executorExpired: boolean;
  executorLinked: boolean;
  hasBenchmark: boolean;
};

const checksCache = new Map<string, { checks: OnchainChecks; timestamp: number }>();
const CHECKS_CACHE_TTL_MS = 30_000;

async function readWalletChecks(
  walletAddress: `0x${string}`,
  agentIdentityId?: string,
): Promise<OnchainChecks> {
  const cacheKey = `${walletAddress.toLowerCase()}:${agentIdentityId ?? ""}`;
  const cached = checksCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CHECKS_CACHE_TTL_MS) {
    return cached.checks;
  }

  const [autonomy, benchmark] = await Promise.all([
    readAutonomyStateOnchain({
      agentId: agentIdentityId,
      walletAddress,
    }).catch(() => undefined),
    readActiveBenchmarkForAgent(agentIdentityId).catch(() => undefined),
  ]);

  const executorConfigured = Boolean(
    autonomy &&
      autonomy.enabled &&
      autonomy.executor.toLowerCase() !== zeroAddress.toLowerCase(),
  );
  // validUntil === 0 means "no expiry" in the wallet contract.
  const executorExpired = Boolean(
    executorConfigured &&
      autonomy &&
      autonomy.validUntil !== 0 &&
      autonomy.validUntil * 1000 <= Date.now(),
  );

  const checks: OnchainChecks = {
    executorExpired,
    executorLinked: executorConfigured && !executorExpired,
    hasBenchmark: Boolean(benchmark),
  };

  checksCache.set(cacheKey, { checks, timestamp: Date.now() });
  return checks;
}

export function computeSmartWalletReadiness({
  balanceMnt,
  balanceLoaded,
  checks,
  walletAddress,
}: {
  balanceMnt: number | null;
  balanceLoaded: boolean;
  checks?: OnchainChecks;
  walletAddress?: string;
}): SmartWalletReadiness {
  if (!walletAddress) {
    return { status: "wallet-missing" };
  }

  if (!balanceLoaded || !checks) {
    return { status: "loading" };
  }

  if (checks.executorExpired) {
    return { status: "executor-expired" };
  }

  const missing: SmartWalletMissingRequirement[] = [];

  if (balanceMnt === null || balanceMnt < MINIMUM_MNT_READY_BALANCE) {
    missing.push("funding");
  }

  if (!checks.hasBenchmark) {
    missing.push("benchmark");
  }

  if (!checks.executorLinked) {
    missing.push("executor");
  }

  if (missing.length > 0) {
    return { missing, status: "setup-missing" };
  }

  return { status: "ready" };
}

export function useSmartWalletReadiness(agent: AgentRecord): SmartWalletReadiness {
  const walletAddress = agent.walletAddress as `0x${string}` | undefined;
  const { balance, isLoading: isBalanceLoading } = useWalletBalance(walletAddress);
  const [checks, setChecks] = useState<OnchainChecks | undefined>();
  const [checksLoaded, setChecksLoaded] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setChecks(undefined);
      setChecksLoaded(true);
      return;
    }

    let cancelled = false;
    setChecksLoaded(false);

    void readWalletChecks(walletAddress, agent.agentIdentityId).then((result) => {
      if (!cancelled) {
        setChecks(result);
        setChecksLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, agent.agentIdentityId]);

  if (!walletAddress) {
    return { status: "wallet-missing" };
  }

  const balanceMnt = (() => {
    try {
      return Number(formatEther(BigInt(balance)));
    } catch {
      return null;
    }
  })();

  return computeSmartWalletReadiness({
    balanceLoaded: !isBalanceLoading && checksLoaded,
    balanceMnt,
    checks: checksLoaded ? checks : undefined,
    walletAddress,
  });
}
