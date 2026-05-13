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
