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
import {
  nexora4337WalletFactoryAbi,
  nexoraAgentIdentityRegistryAbi,
  nexoraSmartWalletRegistryAbi,
} from "@/lib/contracts/abis";
import {
  isAgentWalletDeploymentReady,
  mantleSepoliaContracts,
} from "@/lib/contracts/deployments";
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

type AgentIdentityRecord = {
  agentURI: string;
  agentWallet: Address;
  createdAt: bigint | number;
  owner: Address;
};

const riskModeToChain: Record<RiskMode, number> = {
  balanced: 1,
  conservative: 0,
  experimental: 2,
};

const runnerModeToChain: Record<RunnerMode, number> = {
  demo: 0,
  hosted: 2,
  local: 1,
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

function delay(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function isAgentSmartWalletsEnabled() {
  return isAgentWalletDeploymentReady();
}

async function waitForRegistryReceipt(hash: `0x${string}`, label: string) {
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: mantleSepolia.id,
    timeout: 120_000,
  });

  if (receipt.status === "reverted") {
    throw new Error(`${label} reverted on Mantle.`);
  }

  return receipt;
}

async function smartWalletRecordFromIdentity(
  id: bigint,
  agent: AgentIdentityRecord,
  transactionHash?: `0x${string}`,
): Promise<AgentRecord> {
  const metadata = decodeMetadata(agent.agentURI);
  let preflightThresholds = metadata?.preflightThresholds;
  try {
    preflightThresholds = await readPreflightThresholdsOnchain(id.toString(), {
      useAgentValidation: true,
    });
  } catch {
    preflightThresholds = metadata?.preflightThresholds;
  }
  const createdAt = dateFromChainTimestamp(agent.createdAt);
  const selectedHarnessId = metadata?.selectedHarnessId ?? "safe-approval";
  const riskMode = metadata?.riskMode ?? "conservative";
  const runnerMode = metadata?.runnerMode ?? "local";
  const name = metadata?.name ?? `Smart Wallet ${id.toString()}`;
  const description = metadata?.description ?? metadata?.goal ?? "Autonomous smart wallet";
  const walletAddress = agent.agentWallet === zeroAddress ? undefined : agent.agentWallet;

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
    ownerAddress: agent.owner,
    walletAddress,
    identityStandard: "erc-8004",
    agentIdentityId: id.toString(),
    agentUri: agent.agentURI,
    autonomy: {
      enabled: true,
      entryPointAddress: mantleSepoliaContracts.entryPoint,
      factoryAddress: mantleSepoliaContracts.agent4337WalletFactory,
      validationRegistryAddress: mantleSepoliaContracts.agentValidationRegistry,
    },
    identityTransactionHash: transactionHash,
    walletTransactionHash: transactionHash,
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
      identityStandard: "erc-8004",
      agentIdentityId: id.toString(),
      agentUri: agent.agentURI,
      autonomy: {
        enabled: true,
        entryPointAddress: mantleSepoliaContracts.entryPoint,
        factoryAddress: mantleSepoliaContracts.agent4337WalletFactory,
        validationRegistryAddress: mantleSepoliaContracts.agentValidationRegistry,
      },
      identityTransactionHash: transactionHash,
      createdAt,
    },
    metadataUri: agent.agentURI,
    createdAt,
  };
}

async function findLatestSmartWalletForOwner(
  ownerAddress: `0x${string}`,
  transactionHash?: `0x${string}`,
) {
  const smartWalletIds = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.smartWalletRegistry,
    abi: nexoraSmartWalletRegistryAbi,
    functionName: "smartWalletsOfOwner",
    args: [ownerAddress],
    chainId: mantleSepolia.id,
  });

  for (const smartWalletId of [...smartWalletIds].reverse()) {
    const agent = await getSmartWalletProfileOnchain(
      smartWalletId.toString(),
      transactionHash,
    );

    if (agent) {
      return agent;
    }
  }

  return undefined;
}

async function waitForSmartWalletProfileOnchain({
  ownerAddress,
  smartWalletId,
  transactionHash,
}: {
  ownerAddress: `0x${string}`;
  smartWalletId: string;
  transactionHash?: `0x${string}`;
}) {
  let agent = await getSmartWalletProfileOnchain(smartWalletId, transactionHash);

  for (let attempt = 0; attempt < 10 && !agent; attempt += 1) {
    await delay(1_200 + attempt * 300);
    agent =
      (await getSmartWalletProfileOnchain(smartWalletId, transactionHash)) ??
      (await findLatestSmartWalletForOwner(ownerAddress, transactionHash));
  }

  return agent;
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

  if (isAgentSmartWalletsEnabled()) {
    const nextAgentId = await readContract(wagmiConfig, {
      address: mantleSepoliaContracts.agentIdentityRegistry,
      abi: nexoraAgentIdentityRegistryAbi,
      functionName: "nextAgentId",
      chainId: mantleSepolia.id,
    });
    const salt = keccak256(
      toBytes(`${input.ownerAddress}:${input.name}:${metadata.createdAt}`),
    );
    const transactionHash = await writeContract(wagmiConfig, {
      address: mantleSepoliaContracts.agent4337WalletFactory,
      abi: nexora4337WalletFactoryAbi,
      functionName: "createAgentWallet",
      args: [encodeMetadata({
        ...metadata,
        identityStandard: "erc-8004",
        agentIdentityId: nextAgentId.toString(),
      }), salt],
      chainId: mantleSepolia.id,
    });

    if (!transactionHash) {
      throw new Error("No transaction hash returned from smart wallet factory.");
    }

    await waitForRegistryReceipt(transactionHash, "smart wallet deployment");

    const agent = await getAgentSmartWalletProfileOnchain(
      nextAgentId.toString(),
      transactionHash,
    );

    if (!agent) {
      throw new Error(
        "Smart wallet was created, but Mantle has not indexed the identity yet. Refresh the dashboard in a few seconds.",
      );
    }

    return agent;
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

  await waitForRegistryReceipt(transactionHash, "Smart wallet profile registration");

  const agent = await waitForSmartWalletProfileOnchain({
    ownerAddress: input.ownerAddress,
    smartWalletId: nextSmartWalletId.toString(),
    transactionHash,
  });

  if (!agent) {
    throw new Error(
      "Smart wallet profile was registered on Mantle, but the registry read is still catching up. Refresh the dashboard in a few seconds.",
    );
  }

  return agent;
}

export async function createSmartWalletOnchain(
  agent: AgentRecord,
  ownerAddress: `0x${string}`,
) {
  if (agent.identityStandard === "erc-8004") {
    if (agent.walletAddress) {
      return agent;
    }

    const refreshed = await getAgentSmartWalletProfileOnchain(agent.id, agent.walletTransactionHash);
    return refreshed ?? agent;
  }

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

  await waitForRegistryReceipt(transactionHash, "Smart wallet deployment");

  let updatedAgent = await getSmartWalletProfileOnchain(agent.id);

  for (let attempt = 0; attempt < 5 && !updatedAgent?.walletAddress; attempt += 1) {
    await delay(1200);
    updatedAgent = await getSmartWalletProfileOnchain(agent.id);
  }

  if (!updatedAgent) {
    return {
      ...agent,
      walletTransactionHash: transactionHash,
    };
  }

  if (!updatedAgent.walletAddress) {
    return {
      ...updatedAgent,
      walletDeploymentPending: true,
      walletTransactionHash: transactionHash,
    };
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

  return getAgentSmartWalletProfileOnchain(smartWalletId, transactionHash);
}

async function getAgentSmartWalletProfileOnchain(
  agentId: string,
  transactionHash?: `0x${string}`,
) {
  if (!isAgentSmartWalletsEnabled()) {
    return undefined;
  }

  try {
    const agent = await readContract(wagmiConfig, {
      address: mantleSepoliaContracts.agentIdentityRegistry,
      abi: nexoraAgentIdentityRegistryAbi,
      functionName: "getAgent",
      args: [BigInt(agentId)],
      chainId: mantleSepolia.id,
    });

    return smartWalletRecordFromIdentity(BigInt(agentId), agent, transactionHash);
  } catch {
    return undefined;
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

  return isAgentSmartWalletsEnabled()
    ? await readContract(wagmiConfig, {
        address: mantleSepoliaContracts.agentIdentityRegistry,
        abi: nexoraAgentIdentityRegistryAbi,
        functionName: "agentsOfOwner",
        args: [ownerAddress],
        chainId: mantleSepolia.id,
      })
        .then((agentIds) =>
          Promise.all(
            agentIds.map((agentId) => getAgentSmartWalletProfileOnchain(agentId.toString())),
          ),
        )
        .then((agents) => agents.filter((agent): agent is AgentRecord => Boolean(agent)))
        .catch(() => [])
    : [];
}
