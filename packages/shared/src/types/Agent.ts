import type { AgentRuntimeId } from "./AgentRuntime";
import type { HarnessId } from "./Harness";
import type { ObjectiveRun } from "./ObjectiveRun";

export type RiskMode = "conservative" | "balanced" | "experimental";
export type AgentStrategyType = "defensive" | "balanced" | "opportunistic";
export type AgentType =
  | "wallet-defense"
  | "safe-yield"
  | "trading"
  | "custom";
export type RunnerMode = "demo" | "local" | "hosted";

export type AgentProfile = {
  id: string;
  name: string;
  goal: string;
  description?: string;
  agentType?: AgentType;
  runtime?: AgentRuntimeId;
  runnerMode?: RunnerMode;
  strategyType?: AgentStrategyType;
  primaryPurpose?: string;
  decisionStyle?: string;
  preferredBehavior?: string;
  avoidedBehavior?: string;
  selectedHarnessId?: HarnessId;
  riskMode: RiskMode;
  ownerAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
  identityTransactionHash?: `0x${string}`;
  walletTransactionHash?: `0x${string}`;
  metadataUri?: string;
  objectiveRuns?: ObjectiveRun[];
};

export type AgentMetadata = {
  name: string;
  goal: string;
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
  identityTransactionHash?: `0x${string}`;
  createdAt: string;
};

export type AgentRecord = AgentProfile & {
  id: string;
  ownerAddress: `0x${string}`;
  metadataUri: string;
  metadata: AgentMetadata;
  createdAt: string;
  objectiveRuns?: ObjectiveRun[];
  policy?: import("./Policy").PolicyProfile;
};
