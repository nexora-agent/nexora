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
export type SmartWalletMissionType =
  | "wallet-defense"
  | "safe-yield"
  | "trading"
  | "custom";
export type SmartWalletExecutionMode = "simulation" | "policy-gated" | "live-disabled";
export type SmartWalletModelConfig = {
  runnerMode: RunnerMode;
  provider: "demo" | "local" | "hosted";
  modelName: string;
  endpointUrl?: string;
  temperature: number;
  maxTokens: number;
  executionMode: SmartWalletExecutionMode;
};
export type SmartWalletToolStatus = "demo" | "live" | "coming-soon";
export type SmartWalletToolGroup =
  | "wallet"
  | "risk"
  | "benchmark-defi"
  | "byreal";
export type SmartWalletToolConfig = {
  id: string;
  name: string;
  group: SmartWalletToolGroup;
  status: SmartWalletToolStatus;
  enabled: boolean;
  description: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  goal: string;
  description?: string;
  agentType?: AgentType;
  missionType?: SmartWalletMissionType;
  runtime?: AgentRuntimeId;
  runnerMode?: RunnerMode;
  modelConfig?: SmartWalletModelConfig;
  toolsConfig?: SmartWalletToolConfig[];
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
  walletFundingTransactionHash?: `0x${string}`;
  walletFundedAt?: string;
  metadataUri?: string;
  objectiveRuns?: ObjectiveRun[];
};

export type AgentMetadata = {
  name: string;
  goal: string;
  description: string;
  agentType?: AgentType;
  missionType?: SmartWalletMissionType;
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
