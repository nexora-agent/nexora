"use client";

import type {
  AgentMetadata,
  AgentRecord,
  AgentRuntimeId,
  AgentStrategyType,
  AgentType,
  HarnessId,
  ObjectiveRun,
  PolicyProfile,
  RiskMode,
  RunnerMode,
} from "@nexora/shared";

const agentsKey = "nexora.agents";
const nextAgentIdKey = "nexora.nextAgentId";

type CreateAgentInput = {
  id?: string;
  name: string;
  description: string;
  agentType?: AgentType;
  runtime: AgentRuntimeId;
  runnerMode?: RunnerMode;
  strategyType: AgentStrategyType;
  primaryPurpose?: string;
  decisionStyle?: string;
  preferredBehavior?: string;
  avoidedBehavior?: string;
  selectedHarnessId?: HarnessId;
  riskMode: RiskMode;
  ownerAddress: `0x${string}`;
  identityTransactionHash?: `0x${string}`;
};

function readAgents(): AgentRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawAgents = window.localStorage.getItem(agentsKey);
  if (!rawAgents) {
    return [];
  }

  try {
    return JSON.parse(rawAgents) as AgentRecord[];
  } catch {
    return [];
  }
}

function writeAgents(agents: AgentRecord[]) {
  window.localStorage.setItem(agentsKey, JSON.stringify(agents));
}

function readNextAgentId() {
  const rawNextAgentId = window.localStorage.getItem(nextAgentIdKey);
  const nextAgentId = rawNextAgentId ? Number(rawNextAgentId) : 1;
  return Number.isFinite(nextAgentId) && nextAgentId > 0 ? nextAgentId : 1;
}

export function createLocalAgent(input: CreateAgentInput): AgentRecord {
  const agents = readAgents();
  const nextAgentId = readNextAgentId();
  const id = input.id ?? String(nextAgentId);
  const createdAt = new Date().toISOString();
  const metadataUri = `ipfs://nexora-local/agent-${id}`;

  const metadata: AgentMetadata = {
    name: input.name,
    goal: input.description,
    description: input.description,
    agentType: input.agentType,
    runtime: input.runtime,
    runnerMode: input.runnerMode,
    strategyType: input.strategyType,
    primaryPurpose: input.primaryPurpose,
    decisionStyle: input.decisionStyle,
    preferredBehavior: input.preferredBehavior,
    avoidedBehavior: input.avoidedBehavior,
    selectedHarnessId: input.selectedHarnessId ?? "safe-approval",
    riskMode: input.riskMode,
    identityTransactionHash: input.identityTransactionHash,
    createdAt,
  };

  const agent: AgentRecord = {
    id,
    name: input.name,
    goal: input.description,
    description: input.description,
    agentType: input.agentType,
    runtime: input.runtime,
    runnerMode: input.runnerMode,
    strategyType: input.strategyType,
    primaryPurpose: input.primaryPurpose,
    decisionStyle: input.decisionStyle,
    preferredBehavior: input.preferredBehavior,
    avoidedBehavior: input.avoidedBehavior,
    selectedHarnessId: input.selectedHarnessId ?? "safe-approval",
    riskMode: input.riskMode,
    ownerAddress: input.ownerAddress,
    metadata,
    metadataUri,
    identityTransactionHash: input.identityTransactionHash,
    createdAt,
  };

  writeAgents([
    ...agents.filter((candidate) => candidate.id !== agent.id),
    agent,
  ]);
  const parsedId = Number(id);
  const nextId =
    Number.isFinite(parsedId) && parsedId > 0
      ? Math.max(nextAgentId, parsedId + 1)
      : nextAgentId + 1;
  window.localStorage.setItem(nextAgentIdKey, String(nextId));

  return agent;
}

export function getLocalAgent(agentId: string): AgentRecord | undefined {
  return readAgents().find((agent) => agent.id === agentId);
}

export function listLocalAgents() {
  return readAgents();
}

function localWalletAddressForAgent(agentId: string): `0x${string}` {
  const paddedAgentId = BigInt(agentId).toString(16).padStart(40, "0");
  return `0x${paddedAgentId}`;
}

export function createLocalAgentWallet(
  agentId: string,
  ownerAddress: `0x${string}`,
  walletAddress?: `0x${string}`,
  walletTransactionHash?: `0x${string}`,
): AgentRecord {
  const agents = readAgents();
  const agent = agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error("Smart wallet not found.");
  }

  if (agent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Only the owner wallet can create this smart wallet.");
  }

  if (agent.walletAddress) {
    return agent;
  }

  const updatedAgent: AgentRecord = {
    ...agent,
    walletAddress: walletAddress ?? localWalletAddressForAgent(agent.id),
    walletTransactionHash,
  };

  writeAgents(
    agents.map((candidate) =>
      candidate.id === agent.id ? updatedAgent : candidate,
    ),
  );

  return updatedAgent;
}

export const defaultPolicy: PolicyProfile = {
  maxRiskScore: 60,
  maxTransactionSizeUsd: 20,
  blockUnlimitedApprovals: true,
  blockUnverifiedContracts: true,
  requireRiskReport: true,
};

export const balancedPolicy: PolicyProfile = {
  maxRiskScore: 75,
  maxTransactionSizeUsd: 100,
  blockUnlimitedApprovals: true,
  blockUnverifiedContracts: false,
  requireRiskReport: true,
};

export function getAgentPolicy(agent: AgentRecord): PolicyProfile {
  return agent.policy ?? defaultPolicy;
}

export function saveLocalAgentPolicy(
  agentId: string,
  ownerAddress: `0x${string}`,
  policy: PolicyProfile,
): AgentRecord {
  const agents = readAgents();
  const agent = agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error("Smart wallet not found.");
  }

  if (agent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Only the owner wallet can update this policy.");
  }

  if (policy.maxRiskScore < 0 || policy.maxRiskScore > 100) {
    throw new Error("Max risk score must be between 0 and 100.");
  }

  if (policy.maxTransactionSizeUsd < 0) {
    throw new Error("Max transaction size cannot be negative.");
  }

  const updatedAgent: AgentRecord = {
    ...agent,
    policy,
  };

  writeAgents(
    agents.map((candidate) =>
      candidate.id === agent.id ? updatedAgent : candidate,
    ),
  );

  return updatedAgent;
}

export function saveLocalAgentHarness(
  agentId: string,
  ownerAddress: `0x${string}`,
  selectedHarnessId: HarnessId,
): AgentRecord {
  const agents = readAgents();
  const agent = agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error("Smart wallet not found.");
  }

  if (agent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Only the owner wallet can update this harness.");
  }

  const updatedAgent: AgentRecord = {
    ...agent,
    metadata: {
      ...agent.metadata,
      selectedHarnessId,
    },
    selectedHarnessId,
  };

  writeAgents(
    agents.map((candidate) =>
      candidate.id === agent.id ? updatedAgent : candidate,
    ),
  );

  return updatedAgent;
}

export function saveLocalObjectiveRun(
  agentId: string,
  ownerAddress: `0x${string}`,
  run: ObjectiveRun,
): AgentRecord {
  const agents = readAgents();
  const agent = agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error("Smart wallet not found.");
  }

  if (agent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Only the owner wallet can run objectives.");
  }

  const updatedAgent: AgentRecord = {
    ...agent,
    objectiveRuns: [run, ...(agent.objectiveRuns ?? [])],
  };

  writeAgents(
    agents.map((candidate) =>
      candidate.id === agent.id ? updatedAgent : candidate,
    ),
  );

  return updatedAgent;
}

export function updateLocalObjectiveRun(
  agentId: string,
  ownerAddress: `0x${string}`,
  run: ObjectiveRun,
): AgentRecord {
  const agents = readAgents();
  const agent = agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error("Smart wallet not found.");
  }

  if (agent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Only the owner wallet can update objective runs.");
  }

  const updatedAgent: AgentRecord = {
    ...agent,
    objectiveRuns: (agent.objectiveRuns ?? []).map((candidate) =>
      candidate.id === run.id ? run : candidate,
    ),
  };

  writeAgents(
    agents.map((candidate) =>
      candidate.id === agent.id ? updatedAgent : candidate,
    ),
  );

  return updatedAgent;
}
