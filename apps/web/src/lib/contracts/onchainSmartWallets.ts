import type {
  AgentMetadata,
  AgentRecord,
  AgentRuntimeId,
  AgentStrategyType,
  AgentType,
  HarnessId,
  RiskMode,
  RunnerMode,
  SmartWalletModelConfig,
  SmartWalletToolConfig,
} from "@nexora/shared";
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { keccak256, toBytes, zeroAddress } from "viem";
import {
  createLocalAgent,
  createLocalAgentWallet,
  listLocalAgents,
} from "@/lib/agents/localAgentRegistry";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexoraSmartWalletRegistryAbi } from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";
import { isNexoraMockWallet } from "./onchainAgents";
import { readPreflightThresholdsOnchain } from "./onchainPreflight";

type CreateSmartWalletProfileInput = {
  name: string;
  description: string;
  agentType?: AgentType;
  runtime: AgentRuntimeId;
  runnerMode?: RunnerMode;
  modelConfig?: SmartWalletModelConfig;
  toolsConfig?: SmartWalletToolConfig[];
  strategyType: AgentStrategyType;
  primaryPurpose?: string;
  decisionStyle?: string;
  preferredBehavior?: string;
  avoidedBehavior?: string;
  selectedHarnessId?: HarnessId;
  riskMode: RiskMode;
  ownerAddress: `0x${string}`;
};

type RegistrySmartWallet = {
  createdAt: bigint | number;
  harnessId: `0x${string}`;
  metadataURI: string;
  owner: Address;
  riskMode: number;
  runnerMode: number;
  wallet: Address;
  walletCreatedAt: bigint | number;
};

const riskModeToChain: Record<RiskMode, number> = {
  balanced: 1,
  conservative: 0,
  experimental: 2,
};

const chainToRiskMode: Record<number, RiskMode> = {
  0: "conservative",
  1: "balanced",
  2: "experimental",
};

const runnerModeToChain: Record<RunnerMode, number> = {
  demo: 0,
  hosted: 2,
  local: 1,
};

const chainToRunnerMode: Record<number, RunnerMode> = {
  0: "demo",
  1: "local",
  2: "hosted",
};

function harnessIdToBytes32(harnessId: HarnessId) {
  return keccak256(toBytes(harnessId));
}

function encodeMetadata(metadata: AgentMetadata) {
  return `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
}

function decodeMetadata(metadataUri: string): AgentMetadata | undefined {
  const prefix = "data:application/json,";
  if (!metadataUri.startsWith(prefix)) {
    return undefined;
  }

  try {
    return JSON.parse(decodeURIComponent(metadataUri.slice(prefix.length))) as AgentMetadata;
  } catch {
    return undefined;
  }
}

function dateFromChainTimestamp(timestamp: bigint | number) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    return new Date().toISOString();
  }

  return new Date(numericTimestamp * 1000).toISOString();
}

function isSmartWalletNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("SmartWalletNotFound") ||
    error.message.includes("0xd7624a57") ||
    error.message.includes("execution reverted")
  );
}

async function smartWalletRecordFromChain(
  id: bigint,
  smartWallet: RegistrySmartWallet,
  transactionHash?: `0x${string}`,
): Promise<AgentRecord> {
  const metadata = decodeMetadata(smartWallet.metadataURI);
  let preflightThresholds = metadata?.preflightThresholds;
  try {
    preflightThresholds = await readPreflightThresholdsOnchain(id.toString());
  } catch {
    preflightThresholds = metadata?.preflightThresholds;
  }
  const createdAt = dateFromChainTimestamp(smartWallet.createdAt);
  const selectedHarnessId = metadata?.selectedHarnessId ?? "safe-approval";
  const riskMode = metadata?.riskMode ?? chainToRiskMode[smartWallet.riskMode] ?? "conservative";
  const runnerMode = metadata?.runnerMode ?? chainToRunnerMode[smartWallet.runnerMode] ?? "demo";
  const name = metadata?.name ?? `Smart Wallet ${id.toString()}`;
  const description = metadata?.description ?? metadata?.goal ?? "On-chain smart wallet";

  return {
    id: id.toString(),
    name,
    goal: description,
    description,
    agentType: metadata?.agentType ?? "custom",
    missionType: metadata?.missionType ?? metadata?.agentType ?? "custom",
    runtime: metadata?.runtime ?? "nexora-local",
    runnerMode,
    modelConfig: metadata?.modelConfig,
    toolsConfig: metadata?.toolsConfig,
    preflightThresholds,
    strategyType: metadata?.strategyType ?? "defensive",
    primaryPurpose: metadata?.primaryPurpose,
    decisionStyle: metadata?.decisionStyle,
    preferredBehavior: metadata?.preferredBehavior,
    avoidedBehavior: metadata?.avoidedBehavior,
    selectedHarnessId,
    riskMode,
    ownerAddress: smartWallet.owner,
    walletAddress: smartWallet.wallet === zeroAddress ? undefined : smartWallet.wallet,
    identityTransactionHash: transactionHash,
    metadata: {
      name,
      goal: description,
      description,
      agentType: metadata?.agentType ?? "custom",
      missionType: metadata?.missionType ?? metadata?.agentType ?? "custom",
      runtime: metadata?.runtime ?? "nexora-local",
      runnerMode,
      modelConfig: metadata?.modelConfig,
      toolsConfig: metadata?.toolsConfig,
      preflightThresholds,
      strategyType: metadata?.strategyType ?? "defensive",
      primaryPurpose: metadata?.primaryPurpose,
      decisionStyle: metadata?.decisionStyle,
      preferredBehavior: metadata?.preferredBehavior,
      avoidedBehavior: metadata?.avoidedBehavior,
      selectedHarnessId,
      riskMode,
      identityTransactionHash: transactionHash,
      createdAt,
    },
    metadataUri: smartWallet.metadataURI,
    createdAt,
  };
}

export async function createSmartWalletProfileOnchain(
  input: CreateSmartWalletProfileInput,
) {
  const metadata: AgentMetadata = {
    name: input.name,
    goal: input.description,
    description: input.description,
    agentType: input.agentType,
    missionType: input.agentType,
    runtime: input.runtime,
    runnerMode: input.runnerMode,
    modelConfig: input.modelConfig,
    toolsConfig: input.toolsConfig,
    strategyType: input.strategyType,
    primaryPurpose: input.primaryPurpose,
    decisionStyle: input.decisionStyle,
    preferredBehavior: input.preferredBehavior,
    avoidedBehavior: input.avoidedBehavior,
    selectedHarnessId: input.selectedHarnessId ?? "safe-approval",
    riskMode: input.riskMode,
    createdAt: new Date().toISOString(),
  };

  if (isNexoraMockWallet()) {
    return createLocalAgent({
      ...input,
      selectedHarnessId: input.selectedHarnessId ?? "safe-approval",
    });
  }

  const nextSmartWalletId = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.smartWalletRegistry,
    abi: nexoraSmartWalletRegistryAbi,
    functionName: "nextSmartWalletId",
    chainId: mantleSepolia.id,
  });

  const transactionHash = await writeContract(wagmiConfig, {
    address: mantleSepoliaContracts.smartWalletRegistry,
    abi: nexoraSmartWalletRegistryAbi,
    functionName: "registerSmartWallet",
    args: [
      encodeMetadata(metadata),
      harnessIdToBytes32(metadata.selectedHarnessId ?? "safe-approval"),
      riskModeToChain[input.riskMode],
      runnerModeToChain[input.runnerMode ?? "demo"],
    ],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  const agent = await getSmartWalletProfileOnchain(nextSmartWalletId.toString(), transactionHash);
  if (!agent) {
    throw new Error("Smart wallet was registered but could not be loaded.");
  }

  return agent;
}

export async function createSmartWalletOnchain(
  agent: AgentRecord,
  ownerAddress: `0x${string}`,
) {
  if (isNexoraMockWallet()) {
    return createLocalAgentWallet(agent.id, ownerAddress);
  }

  const transactionHash = await writeContract(wagmiConfig, {
    address: mantleSepoliaContracts.smartWalletRegistry,
    abi: nexoraSmartWalletRegistryAbi,
    functionName: "createSmartWallet",
    args: [BigInt(agent.id)],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  const updatedAgent = await getSmartWalletProfileOnchain(agent.id);
  if (!updatedAgent?.walletAddress) {
    throw new Error("Smart wallet was created but no address was returned.");
  }

  return {
    ...updatedAgent,
    walletTransactionHash: transactionHash,
  };
}

export async function getSmartWalletProfileOnchain(
  smartWalletId: string,
  transactionHash?: `0x${string}`,
) {
  if (isNexoraMockWallet()) {
    return listLocalAgents().find((agent) => agent.id === smartWalletId);
  }

  try {
    const smartWallet = await readContract(wagmiConfig, {
      address: mantleSepoliaContracts.smartWalletRegistry,
      abi: nexoraSmartWalletRegistryAbi,
      functionName: "getSmartWallet",
      args: [BigInt(smartWalletId)],
      chainId: mantleSepolia.id,
    });

    return smartWalletRecordFromChain(BigInt(smartWalletId), smartWallet, transactionHash);
  } catch (error) {
    if (isSmartWalletNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function listSmartWalletProfilesOnchain(ownerAddress?: `0x${string}`) {
  if (!ownerAddress) {
    return [];
  }

  if (isNexoraMockWallet()) {
    return listLocalAgents().filter(
      (agent) => agent.ownerAddress.toLowerCase() === ownerAddress.toLowerCase(),
    );
  }

  const smartWalletIds = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.smartWalletRegistry,
    abi: nexoraSmartWalletRegistryAbi,
    functionName: "smartWalletsOfOwner",
    args: [ownerAddress],
    chainId: mantleSepolia.id,
  });

  const smartWallets = await Promise.all(
    smartWalletIds.map(async (smartWalletId) => {
      try {
        return await getSmartWalletProfileOnchain(smartWalletId.toString());
      } catch {
        return undefined;
      }
    }),
  );

  return smartWallets.filter((agent): agent is AgentRecord => Boolean(agent));
}
