"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  formatEther,
  http,
  parseAbiItem,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentReputationRegistryAbi,
  nexoraAgentValidationRegistryAbi,
  nexoraBenchmarkVaultAbi,
} from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";

type LatestValidation = {
  actionIntentHash?: Hex;
  adversarialScore?: number;
  averageScore?: number;
  basicScore?: number;
  blockNumber?: bigint;
  externalScore?: number;
  harnessHash?: Hex;
  modelHash?: Hex;
  passed?: boolean;
  policyHash?: Hex;
  reportHash?: Hex;
  riskScore?: number;
  suiteHash?: Hex;
  timestamp?: number;
  toolsHash?: Hex;
  txHash?: Hex;
};

type LatestExecution = {
  actionIntentHash?: Hex;
  blockNumber?: bigint;
  status?: "success" | "failed" | "unknown";
  target?: Address;
  txHash?: Hex;
  value?: string;
};

type OnchainRunnerActivity = {
  agentId: string;
  latestExecution?: LatestExecution;
  latestValidation?: LatestValidation;
  reputation?: {
    benchmarkRuns?: number;
    blockedActions?: number;
    policyViolations?: number;
    safeActions?: number;
    trustScore?: number;
  };
  safeVaultPosition?: {
    balanceMnt: string;
    vaultAddress: string;
  };
  walletAddress: string;
};

type UseOnchainRunnerActivityResult = {
  activity?: OnchainRunnerActivity;
  error?: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(mantleSepolia.rpcUrls.default.http[0]),
});

const cacheTtlMs = 30_000;
const validationRecordedEvent = parseAbiItem(
  "event ValidationRecorded(uint256 indexed agentId, bytes32 indexed actionIntentHash, bytes32 indexed reportHash, uint16 averageScore, bool passed, address reporter)",
);
const activityCache = new Map<
  string,
  {
    activity: OnchainRunnerActivity;
    timestamp: number;
  }
>();
const inFlightReads = new Map<string, Promise<OnchainRunnerActivity>>();

function isConfigured(address: string) {
  return address.toLowerCase() !== zeroAddress.toLowerCase();
}

async function readValidationHashes(agentId: string) {
  try {
    return await publicClient.readContract({
      abi: nexoraAgentValidationRegistryAbi,
      address: mantleSepoliaContracts.agentValidationRegistry,
      args: [BigInt(agentId)],
      functionName: "validationsOfAgent",
    });
  } catch {
    return publicClient.readContract({
      abi: nexoraAgentValidationRegistryAbi,
      address: mantleSepoliaContracts.agentValidationRegistry,
      args: [BigInt(agentId)],
      functionName: "getAgentValidations",
    });
  }
}

async function readValidationEventTx({
  actionIntentHash,
  agentId,
  reportHash,
}: {
  actionIntentHash: Hex;
  agentId: string;
  reportHash: Hex;
}) {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = latestBlock > 100_000n ? latestBlock - 100_000n : 0n;
  const logs = await publicClient.getLogs({
    address: mantleSepoliaContracts.agentValidationRegistry,
    args: {
      actionIntentHash,
      agentId: BigInt(agentId),
      reportHash,
    },
    event: validationRecordedEvent,
    fromBlock,
    toBlock: latestBlock,
  });

  const latestLog = logs.at(-1);
  if (!latestLog) {
    return undefined;
  }

  return {
    blockNumber: latestLog.blockNumber,
    txHash: latestLog.transactionHash,
  };
}

async function readLatestValidation(agentId: string) {
  if (!isConfigured(mantleSepoliaContracts.agentValidationRegistry)) {
    return undefined;
  }

  const hashes = await readValidationHashes(agentId);
  const latestHash = hashes.at(-1);
  if (!latestHash) {
    return undefined;
  }

  const record = await publicClient.readContract({
    abi: nexoraAgentValidationRegistryAbi,
    address: mantleSepoliaContracts.agentValidationRegistry,
    args: [latestHash],
    functionName: "getValidation",
  });
  const eventTx = await readValidationEventTx({
    actionIntentHash: record.actionIntentHash,
    agentId,
    reportHash: record.reportHash,
  }).catch(() => undefined);

  return {
    actionIntentHash: record.actionIntentHash,
    adversarialScore: Number(record.adversarialScore),
    averageScore: Number(record.averageScore),
    basicScore: Number(record.basicScore),
    blockNumber: eventTx?.blockNumber,
    externalScore: Number(record.externalScore),
    harnessHash: record.harnessHash,
    modelHash: record.modelHash,
    passed: record.passed,
    policyHash: record.policyHash,
    reportHash: record.reportHash,
    riskScore: Number(record.maxRiskScore),
    suiteHash: record.suiteHash,
    timestamp: Number(record.timestamp),
    toolsHash: record.toolsHash,
    txHash: eventTx?.txHash,
  } satisfies LatestValidation;
}

async function readSafeVaultPosition(walletAddress: Address) {
  if (!isConfigured(mantleSepoliaContracts.safeVault)) {
    return undefined;
  }

  const balance = await publicClient.readContract({
    abi: nexoraBenchmarkVaultAbi,
    address: mantleSepoliaContracts.safeVault,
    args: [walletAddress],
    functionName: "balanceOf",
  });

  return {
    balanceMnt: `${formatEther(balance)} MNT`,
    vaultAddress: mantleSepoliaContracts.safeVault,
  };
}

async function readActivity(agentId: string, walletAddress: `0x${string}`) {
  const latestValidation = await readLatestValidation(agentId);
  const [safeVaultPosition, reputation] = await Promise.all([
    readSafeVaultPosition(walletAddress).catch(() => undefined),
    readReputation(agentId).catch(() => undefined),
  ]);

  return {
    agentId,
    latestValidation,
    reputation,
    safeVaultPosition,
    walletAddress,
  } satisfies OnchainRunnerActivity;
}

async function readReputation(agentId: string) {
  if (!isConfigured(mantleSepoliaContracts.agentReputationRegistry)) {
    return undefined;
  }

  const reputation = await publicClient.readContract({
    abi: nexoraAgentReputationRegistryAbi,
    address: mantleSepoliaContracts.agentReputationRegistry,
    args: [BigInt(agentId)],
    functionName: "getReputation",
  });

  return {
    benchmarkRuns: Number(reputation.benchmarkRuns),
    blockedActions: Number(reputation.blockedExecutions),
    policyViolations: Number(reputation.policyViolations),
    safeActions: Number(reputation.safeExecutions),
    trustScore: Number(reputation.trustScore),
  };
}

export function useOnchainRunnerActivity({
  agentId,
  walletAddress,
}: {
  agentId?: string;
  walletAddress?: `0x${string}`;
}): UseOnchainRunnerActivityResult {
  const [activity, setActivity] = useState<OnchainRunnerActivity | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!agentId || !walletAddress || walletAddress.toLowerCase() === zeroAddress.toLowerCase()) {
      setActivity(undefined);
      return;
    }

    const cacheKey = `${agentId}:${walletAddress.toLowerCase()}`;
    const cached = activityCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      setActivity(cached.activity);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const existingRead = inFlightReads.get(cacheKey);
      const nextActivity =
        existingRead ??
        readActivity(agentId, walletAddress).finally(() => {
          inFlightReads.delete(cacheKey);
        });

      if (!existingRead) {
        inFlightReads.set(cacheKey, nextActivity);
      }

      const resolvedActivity = await nextActivity;
      activityCache.set(cacheKey, {
        activity: resolvedActivity,
        timestamp: Date.now(),
      });
      setActivity(resolvedActivity);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not read on-chain runner activity.");
    } finally {
      setLoading(false);
    }
  }, [agentId, walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { activity, error, loading, refresh };
}
