import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address, Hex } from "viem";
import { createPublicClient, decodeFunctionData, http, parseAbiItem, zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexoraBenchmarkRegistryAbi } from "@/lib/contracts/abis";
import { isBenchmarkRegistryReady, mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";
import {
  benchmarkHash,
  canonicalBenchmarkJson,
  riskModeToChain,
  type CustomBenchmarkDefinition,
} from "@/lib/benchmarks/benchmarkDefinition";

export type OnchainBenchmark = {
  active: boolean;
  benchmarkDataJson: string;
  benchmarkHash: Hex;
  benchmarkId: string;
  benchmarkType: string;
  createdAt: string;
  description: string;
  name: string;
  owner: Address;
  riskMode: number;
  targetContracts: Address[];
};

export type OnchainBenchmarkRecord = {
  benchmarkJson?: unknown;
  benchmarkState?: OnchainBenchmark;
  blockNumber?: string;
  contractAddress: Address;
  decodedArgs: unknown;
  decodedTxInput: unknown;
  eventName: "BenchmarkRegistered";
  id: string;
  logIndex?: number;
  rawLog: unknown;
  source: "mantle";
  txHash: Hex;
};

const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(mantleSepolia.rpcUrls.default.http[0]),
});

const benchmarkRegisteredEvent = parseAbiItem(
  "event BenchmarkRegistered(uint256 indexed benchmarkId, address indexed owner, bytes32 indexed benchmarkHash, string name, string benchmarkType, uint8 riskMode)",
);
const logChunkSize = 10n;

async function getLogsChunked<TLog>({
  args,
  address,
  event,
  fromBlock,
  toBlock,
}: {
  args?: Record<string, unknown>;
  address: Address;
  event: typeof benchmarkRegisteredEvent;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const allLogs: TLog[] = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const chunkToBlock = cursor + logChunkSize - 1n > toBlock ? toBlock : cursor + logChunkSize - 1n;
    const logs = await publicClient.getLogs({
      address,
      args,
      event,
      fromBlock: cursor,
      toBlock: chunkToBlock,
    });

    allLogs.push(...(logs as TLog[]));
    cursor = chunkToBlock + 1n;
  }

  return allLogs;
}

function logStartBlock() {
  return BigInt(process.env.NEXT_PUBLIC_NEXORA_START_BLOCK ?? "39141900");
}

function recentLogStartBlock(latestBlock: bigint) {
  const recentStart = latestBlock > 500n ? latestBlock - 500n : 0n;
  const configuredStart = logStartBlock();
  return recentStart > configuredStart ? recentStart : configuredStart;
}

function requireBenchmarkRegistry() {
  if (!isBenchmarkRegistryReady()) {
    throw new Error("Benchmark registry is not deployed yet.");
  }

  return mantleSepoliaContracts.benchmarkRegistry;
}

function normalizeBigInt(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val)),
  );
}

function parseBenchmarkJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function decodeBenchmark(record: Awaited<ReturnType<typeof readBenchmarkRaw>>): OnchainBenchmark {
  return {
    active: record.active,
    benchmarkDataJson: record.benchmarkDataJson,
    benchmarkHash: record.benchmarkHash,
    benchmarkId: record.benchmarkId.toString(),
    benchmarkType: record.benchmarkType,
    createdAt: new Date(Number(record.createdAt) * 1000).toISOString(),
    description: record.description,
    name: record.name,
    owner: record.owner,
    riskMode: Number(record.riskMode),
    targetContracts: [...record.targetContracts],
  };
}

async function readBenchmarkRaw(benchmarkId: bigint) {
  return readContract(wagmiConfig, {
    abi: nexoraBenchmarkRegistryAbi,
    address: requireBenchmarkRegistry(),
    args: [benchmarkId],
    chainId: mantleSepolia.id,
    functionName: "getBenchmark",
  });
}

async function waitForMantle(hash: `0x${string}`, label: string) {
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    chainId: mantleSepolia.id,
    hash,
    timeout: 120_000,
  });

  if (receipt.status === "reverted") {
    throw new Error(`${label} reverted on Mantle.`);
  }

  return receipt;
}

export async function registerBenchmarkOnchain(benchmark: CustomBenchmarkDefinition) {
  const benchmarkDataJson = canonicalBenchmarkJson(benchmark);
  const hash = await writeContract(wagmiConfig, {
    abi: nexoraBenchmarkRegistryAbi,
    address: requireBenchmarkRegistry(),
    args: [
      benchmark.name,
      benchmark.description,
      benchmark.benchmarkType,
      benchmarkDataJson,
      benchmark.targetContracts,
      riskModeToChain(benchmark.riskMode),
      benchmarkHash(benchmark),
    ],
    chainId: mantleSepolia.id,
    functionName: "registerBenchmark",
  });

  await waitForMantle(hash, "Benchmark registration");
  return hash;
}

export async function selectBenchmarkForAgentOnchain({
  agentId,
  benchmarkId,
}: {
  agentId: string;
  benchmarkId: string;
}) {
  const hash = await writeContract(wagmiConfig, {
    abi: nexoraBenchmarkRegistryAbi,
    address: requireBenchmarkRegistry(),
    args: [BigInt(agentId), BigInt(benchmarkId)],
    chainId: mantleSepolia.id,
    functionName: "selectBenchmarkForAgent",
  });

  await waitForMantle(hash, "Benchmark selection");
  return hash;
}

export async function readBenchmarksOfOwner(owner?: Address) {
  if (!owner || !isBenchmarkRegistryReady()) {
    return [];
  }

  const benchmarkIds = await readContract(wagmiConfig, {
    abi: nexoraBenchmarkRegistryAbi,
    address: mantleSepoliaContracts.benchmarkRegistry,
    args: [owner],
    chainId: mantleSepolia.id,
    functionName: "benchmarksOfOwner",
  });

  const benchmarks = await Promise.all(
    benchmarkIds.map(async (benchmarkId) => decodeBenchmark(await readBenchmarkRaw(benchmarkId))),
  );

  return benchmarks;
}

export async function readBenchmarkRecordsOfOwner(owner?: Address): Promise<OnchainBenchmarkRecord[]> {
  if (!owner || !isBenchmarkRegistryReady()) {
    return [];
  }

  const latestBlock = await publicClient.getBlockNumber();
  const logs = await getLogsChunked<Awaited<ReturnType<typeof publicClient.getLogs>>[number]>({
    address: mantleSepoliaContracts.benchmarkRegistry,
    args: { owner },
    event: benchmarkRegisteredEvent,
    fromBlock: recentLogStartBlock(latestBlock),
    toBlock: latestBlock,
  });

  const records = await Promise.all(
    logs.map(async (log) => {
      const benchmarkId = log.args.benchmarkId ?? 0n;
      const [rawBenchmark, tx] = await Promise.all([
        benchmarkId > 0n ? readBenchmarkRaw(benchmarkId).catch(() => undefined) : Promise.resolve(undefined),
        publicClient.getTransaction({ hash: log.transactionHash }).catch(() => undefined),
      ]);
      const benchmarkState = rawBenchmark ? decodeBenchmark(rawBenchmark) : undefined;
      let decodedTxInput: unknown = null;

      if (tx?.input) {
        try {
          decodedTxInput = decodeFunctionData({
            abi: nexoraBenchmarkRegistryAbi,
            data: tx.input,
          });
        } catch {
          decodedTxInput = null;
        }
      }

      return {
        benchmarkJson: benchmarkState?.benchmarkDataJson
          ? parseBenchmarkJson(benchmarkState.benchmarkDataJson)
          : undefined,
        benchmarkState,
        blockNumber: log.blockNumber?.toString(),
        contractAddress: log.address,
        decodedArgs: normalizeBigInt(log.args),
        decodedTxInput: normalizeBigInt(decodedTxInput),
        eventName: "BenchmarkRegistered" as const,
        id: `${log.transactionHash}-${log.logIndex}`,
        logIndex: log.logIndex,
        rawLog: normalizeBigInt(log),
        source: "mantle" as const,
        txHash: log.transactionHash,
      };
    }),
  );

  return records.sort((left, right) => Number(BigInt(right.blockNumber ?? "0") - BigInt(left.blockNumber ?? "0")));
}

export async function readActiveBenchmarkForAgent(agentId?: string) {
  if (!agentId || !isBenchmarkRegistryReady()) {
    return undefined;
  }

  const benchmarkId = await readContract(wagmiConfig, {
    abi: nexoraBenchmarkRegistryAbi,
    address: mantleSepoliaContracts.benchmarkRegistry,
    args: [BigInt(agentId)],
    chainId: mantleSepolia.id,
    functionName: "activeBenchmarkOfAgent",
  });

  if (benchmarkId === 0n) {
    return undefined;
  }

  const benchmark = await readBenchmarkRaw(benchmarkId);
  if (benchmark.owner.toLowerCase() === zeroAddress.toLowerCase()) {
    return undefined;
  }

  return decodeBenchmark(benchmark);
}
