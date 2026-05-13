"use client";

import type { AgentMetadata, AgentRecord, RiskMode } from "@nexora/shared";

const agentsKey = "nexora.agents";
const nextAgentIdKey = "nexora.nextAgentId";

type CreateAgentInput = {
  name: string;
  goal: string;
  riskMode: RiskMode;
  ownerAddress: `0x${string}`;
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
  const id = String(nextAgentId);
  const createdAt = new Date().toISOString();

  const metadata: AgentMetadata = {
    name: input.name,
    goal: input.goal,
    riskMode: input.riskMode,
    description: `${input.name} is a Nexora agent for ${input.goal}.`,
    createdAt,
  };

  const agent: AgentRecord = {
    id,
    name: input.name,
    goal: input.goal,
    riskMode: input.riskMode,
    ownerAddress: input.ownerAddress,
    metadata,
    metadataUri: `ipfs://nexora-local/agent-${id}`,
    createdAt,
  };

  writeAgents([...agents, agent]);
  window.localStorage.setItem(nextAgentIdKey, String(nextAgentId + 1));

  return agent;
}

export function getLocalAgent(agentId: string): AgentRecord | undefined {
  return readAgents().find((agent) => agent.id === agentId);
}

export function listLocalAgents() {
  return readAgents();
}
