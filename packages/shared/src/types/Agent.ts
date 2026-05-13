export type RiskMode = "conservative" | "balanced" | "experimental";

export type AgentProfile = {
  id: string;
  name: string;
  goal: string;
  riskMode: RiskMode;
  ownerAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
  metadataUri?: string;
};

export type AgentMetadata = {
  name: string;
  goal: string;
  riskMode: RiskMode;
  description: string;
  createdAt: string;
};

export type AgentRecord = AgentProfile & {
  id: string;
  ownerAddress: `0x${string}`;
  metadataUri: string;
  metadata: AgentMetadata;
  createdAt: string;
};
