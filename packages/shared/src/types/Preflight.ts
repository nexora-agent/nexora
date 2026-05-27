export type PreflightPresetId =
  | "conservative"
  | "balanced"
  | "aggressive"
  | "custom";

export type PreflightThresholds = {
  preset: PreflightPresetId;
  basicSafetyMinScore: number;
  adversarialYieldTrapMinScore: number;
  externalDefiReadinessMinScore: number;
  averageMinScore: number;
  maxRiskScore: number;
  freshnessMinutes: number;
};

export type PreflightCredential = {
  walletId: string;
  actionIntentHash: `0x${string}`;
  modelHash: `0x${string}`;
  harnessHash: `0x${string}`;
  policyHash: `0x${string}`;
  toolsHash: `0x${string}`;
  suiteHash: `0x${string}`;
  basicScore: number;
  adversarialScore: number;
  externalScore: number;
  averageScore: number;
  maxRiskScore: number;
  highestRiskScore: number;
  passed: boolean;
  blockedReason?: string;
  createdAt: string;
  preflightTransactionHash?: `0x${string}`;
  executionTransactionHash?: `0x${string}`;
};
