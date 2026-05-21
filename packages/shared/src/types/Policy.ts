export type PolicyProfile = {
  maxRiskScore: number;
  maxTransactionSizeUsd: number;
  blockUnlimitedApprovals: boolean;
  blockUnverifiedContracts: boolean;
  requireRiskReport: boolean;
};

export type PolicyTemplateId = "conservative" | "balanced";
