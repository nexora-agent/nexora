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
  type Log,
} from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentReputationRegistryAbi,
  nexoraAgentValidationRegistryAbi,
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

export type OnchainTimelineEvent = {
  blockNumber?: bigint;
  label: string;
  status: "success" | "failed" | "unknown";
  txHash: Hex;
  type: "validation" | "execution" | "reputation";
  value?: string;
};

export type OnchainRunnerActivity = {
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
  timeline?: OnchainTimelineEvent[];
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

const cacheTtlMs = 90_000;
const validationRecordedEvent = parseAbiItem(
  "event ValidationRecorded(uint256 indexed agentId, bytes32 indexed actionIntentHash, bytes32 indexed reportHash, uint16 averageScore, bool passed, address reporter)",
);
const walletExecutedEvent = parseAbiItem(
  "event Executed(address indexed target, uint256 value, bytes data, bytes result)",
);
const reputationSignalEvent = parseAbiItem(
  "event ReputationSignal(uint256 indexed agentId, bool executed, bool policyViolation, uint16 riskScore, uint16 benchmarkScore, uint256 trustScore, address indexed reporter)",
);
const logChunkSize = 10n;
const recentLogWindowBlocks = BigInt(process.env.NEXT_PUBLIC_NEXORA_ACTIVITY_LOG_WINDOW_BLOCKS ?? "80");
const logChunkDelayMs = Number(process.env.NEXT_PUBLIC_NEXORA_LOG_CHUNK_DELAY_MS ?? "300");
const maxLogRetries = 3;
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

function formatAddress(address: string) {
  if (!address) {
    return "unknown target";
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function logStartBlock() {
  return BigInt(process.env.NEXT_PUBLIC_NEXORA_START_BLOCK ?? "39141900");
}

function recentFromBlock(latestBlock: bigint) {
  const earliest = logStartBlock();
  const recentStart = latestBlock > recentLogWindowBlocks ? latestBlock - recentLogWindowBlocks : earliest;
  return recentStart > earliest ? recentStart : earliest;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.toLowerCase().includes("too many requests");
}

async function readLogsWithRetry(
  params: Parameters<typeof publicClient.getLogs>[0],
) {
  for (let attempt = 0; attempt <= maxLogRetries; attempt += 1) {
    try {
      return await publicClient.getLogs(params);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxLogRetries) {
        throw error;
      }

      await sleep(logChunkDelayMs * 2 ** attempt);
    }
  }

  return [];
}

async function getLogsChunked<TLog>({
  address,
  args,
  event,
  fromBlock,
  toBlock,
}: {
  address: Address;
  args?: Record<string, unknown>;
  event: typeof validationRecordedEvent | typeof walletExecutedEvent | typeof reputationSignalEvent;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const allLogs: TLog[] = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const chunkToBlock = cursor + logChunkSize - 1n > toBlock ? toBlock : cursor + logChunkSize - 1n;
    const logs = await readLogsWithRetry({
      address,
      args,
      event,
      fromBlock: cursor,
      toBlock: chunkToBlock,
    });

    allLogs.push(...(logs as TLog[]));
    cursor = chunkToBlock + 1n;

    if (cursor <= toBlock) {
      await sleep(logChunkDelayMs);
    }
  }

  return allLogs;
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
  const logs = await getLogsChunked<Awaited<ReturnType<typeof publicClient.getLogs>>[number]>({
    address: mantleSepoliaContracts.agentValidationRegistry,
    args: {
      actionIntentHash,
      agentId: BigInt(agentId),
      reportHash,
    },
    event: validationRecordedEvent,
    fromBlock: recentFromBlock(latestBlock),
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
    blockNumber: eventTx?.blockNumber ?? undefined,
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
    txHash: eventTx?.txHash ?? undefined,
  } satisfies LatestValidation;
}

async function readOnchainTimeline({
  agentId,
  walletAddress,
}: {
  agentId: string;
  walletAddress: Address;
}): Promise<OnchainTimelineEvent[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = recentFromBlock(latestBlock);

  const validationLogs = await (
    isConfigured(mantleSepoliaContracts.agentValidationRegistry)
      ? getLogsChunked<Log<bigint, number, boolean, typeof validationRecordedEvent>>({
          address: mantleSepoliaContracts.agentValidationRegistry,
          args: { agentId: BigInt(agentId) },
          event: validationRecordedEvent,
          fromBlock,
          toBlock: latestBlock,
        }).catch(() => [])
      : Promise.resolve([])
  );

  const executionLogs = await getLogsChunked<Log<bigint, number, boolean, typeof walletExecutedEvent>>({
      address: walletAddress,
      event: walletExecutedEvent,
      fromBlock,
      toBlock: latestBlock,
    }).catch(() => []);

  const reputationLogs = await (
    isConfigured(mantleSepoliaContracts.agentReputationRegistry)
      ? getLogsChunked<Log<bigint, number, boolean, typeof reputationSignalEvent>>({
          address: mantleSepoliaContracts.agentReputationRegistry,
          args: { agentId: BigInt(agentId) },
          event: reputationSignalEvent,
          fromBlock,
          toBlock: latestBlock,
        }).catch(() => [])
      : Promise.resolve([])
  );

  // Pending logs have a null transaction hash; the timeline only shows mined events.
  const mined = <T extends { transactionHash: Hex | null }>(logs: T[]) =>
    logs.filter((log): log is T & { transactionHash: Hex } => log.transactionHash !== null);

  return [
    ...mined(validationLogs).map((log) => ({
      blockNumber: log.blockNumber ?? undefined,
      label: log.args.passed
        ? "Benchmark validation passed"
        : "Benchmark validation failed",
      status: log.args.passed ? "success" as const : "failed" as const,
      txHash: log.transactionHash,
      type: "validation" as const,
    })),
    ...mined(executionLogs).map((log) => ({
      blockNumber: log.blockNumber ?? undefined,
      label: `Wallet executed action to ${formatAddress(log.args.target ?? "")}`,
      status: "success" as const,
      txHash: log.transactionHash,
      type: "execution" as const,
      value: log.args.value ? `${formatEther(log.args.value)} MNT` : undefined,
    })),
    ...mined(reputationLogs).map((log) => ({
      blockNumber: log.blockNumber ?? undefined,
      label: log.args.executed
        ? "Safe execution reputation recorded"
        : "Blocked execution reputation recorded",
      status: log.args.executed ? "success" as const : "failed" as const,
      txHash: log.transactionHash,
      type: "reputation" as const,
    })),
  ].sort((left, right) => Number((right.blockNumber ?? 0n) - (left.blockNumber ?? 0n)));
}

async function readActivity(agentId: string, walletAddress: `0x${string}`) {
  const latestValidation = await readLatestValidation(agentId);
  const [reputation, timeline] = await Promise.all([
    readReputation(agentId).catch(() => undefined),
    readOnchainTimeline({ agentId, walletAddress }).catch(() => []),
  ]);

  return {
    agentId,
    latestExecution: timeline.find((event) => event.type === "execution"),
    latestValidation,
    reputation,
    timeline,
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
