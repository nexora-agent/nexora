import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
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

function requireBenchmarkRegistry() {
  if (!isBenchmarkRegistryReady()) {
    throw new Error("Benchmark registry is not deployed yet.");
  }

  return mantleSepoliaContracts.benchmarkRegistry;
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
