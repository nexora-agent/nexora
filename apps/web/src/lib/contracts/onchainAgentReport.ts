import { readContract } from "@wagmi/core";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentIdentityRegistryAbi,
  nexoraAgentValidationRegistryAbi,
} from "@/lib/contracts/abis";
import {
  isAgentWalletDeploymentReady,
  mantleSepoliaContracts,
} from "@/lib/contracts/deployments";
import {
  readActiveBenchmarkForAgent,
  type OnchainBenchmark,
} from "@/lib/contracts/onchainBenchmarks";
import { wagmiConfig } from "@/lib/wagmi/config";

export type OnchainAgentIdentityReport = {
  agentUri: string;
  createdAt: string;
  owner: Address;
  registeredWallet: Address;
  walletMatchesSelected?: boolean;
};

export type OnchainValidationReport = {
  actionIntentHash: Hex;
  adversarialScore: number;
  averageScore: number;
  basicScore: number;
  externalScore: number;
  maxRiskScore: number;
  passed: boolean;
  reportHash: Hex;
  reporter: Address;
  suiteHash: Hex;
  timestamp: number;
};

export type SmartWalletOnchainReport = {
  activeBenchmark?: OnchainBenchmark;
  identity?: OnchainAgentIdentityReport;
  latestValidation?: OnchainValidationReport;
  latestValidationMatchesActiveBenchmark?: boolean;
  validationCount?: number;
};

function isConfigured(address: string) {
  return address.toLowerCase() !== zeroAddress.toLowerCase();
}

function dateFromChainTimestamp(timestamp: bigint | number) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    return undefined;
  }

  return new Date(numericTimestamp * 1000).toISOString();
}

async function readIdentityReportOnchain({
  agentId,
  walletAddress,
}: {
  agentId: string;
  walletAddress?: Address;
}): Promise<OnchainAgentIdentityReport | undefined> {
  if (!isAgentWalletDeploymentReady()) {
    return undefined;
  }

  const agent = await readContract(wagmiConfig, {
    abi: nexoraAgentIdentityRegistryAbi,
    address: mantleSepoliaContracts.agentIdentityRegistry,
    args: [BigInt(agentId)],
    chainId: mantleSepolia.id,
    functionName: "getAgent",
  });
  const registeredWallet = agent.agentWallet as Address;
  const selectedWallet = walletAddress?.toLowerCase();
  const registeredWalletLower = registeredWallet.toLowerCase();

  return {
    agentUri: agent.agentURI,
    createdAt: dateFromChainTimestamp(agent.createdAt) ?? "",
    owner: agent.owner as Address,
    registeredWallet,
    walletMatchesSelected: selectedWallet
      ? selectedWallet === registeredWalletLower
      : undefined,
  };
}

async function readValidationHashes(agentId: string) {
  try {
    return await readContract(wagmiConfig, {
      abi: nexoraAgentValidationRegistryAbi,
      address: mantleSepoliaContracts.agentValidationRegistry,
      args: [BigInt(agentId)],
      chainId: mantleSepolia.id,
      functionName: "validationsOfAgent",
    });
  } catch {
    return readContract(wagmiConfig, {
      abi: nexoraAgentValidationRegistryAbi,
      address: mantleSepoliaContracts.agentValidationRegistry,
      args: [BigInt(agentId)],
      chainId: mantleSepolia.id,
      functionName: "getAgentValidations",
    });
  }
}

async function readValidationHistoryReportOnchain(
  agentId: string,
): Promise<{
  latestValidation?: OnchainValidationReport;
  validationCount: number;
}> {
  if (!isConfigured(mantleSepoliaContracts.agentValidationRegistry)) {
    return { validationCount: 0 };
  }

  const hashes = await readValidationHashes(agentId);
  const latestHash = hashes.at(-1);
  if (!latestHash) {
    return { validationCount: hashes.length };
  }

  const record = await readContract(wagmiConfig, {
    abi: nexoraAgentValidationRegistryAbi,
    address: mantleSepoliaContracts.agentValidationRegistry,
    args: [latestHash],
    chainId: mantleSepolia.id,
    functionName: "getValidation",
  });

  return {
    latestValidation: {
      actionIntentHash: record.actionIntentHash,
      adversarialScore: Number(record.adversarialScore),
      averageScore: Number(record.averageScore),
      basicScore: Number(record.basicScore),
      externalScore: Number(record.externalScore),
      maxRiskScore: Number(record.maxRiskScore),
      passed: record.passed,
      reportHash: record.reportHash,
      reporter: record.reporter,
      suiteHash: record.suiteHash,
      timestamp: Number(record.timestamp),
    },
    validationCount: hashes.length,
  };
}

export async function readSmartWalletOnchainReport({
  agentId,
  walletAddress,
}: {
  agentId?: string;
  walletAddress?: Address;
}): Promise<SmartWalletOnchainReport | undefined> {
  if (!agentId) {
    return undefined;
  }

  const [identity, activeBenchmark, validationHistory] = await Promise.all([
    readIdentityReportOnchain({ agentId, walletAddress }).catch(() => undefined),
    readActiveBenchmarkForAgent(agentId).catch(() => undefined),
    readValidationHistoryReportOnchain(agentId).catch(() => ({
      latestValidation: undefined,
      validationCount: 0,
    })),
  ]);
  const latestValidation = validationHistory?.latestValidation;

  return {
    activeBenchmark,
    identity,
    latestValidation,
    latestValidationMatchesActiveBenchmark:
      activeBenchmark && latestValidation
        ? activeBenchmark.benchmarkHash.toLowerCase() ===
          latestValidation.suiteHash.toLowerCase()
        : undefined,
    validationCount: validationHistory?.validationCount ?? 0,
  };
}
