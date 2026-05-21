import type { PolicyProfile } from "./Policy";
import type { TransactionIntent } from "./TransactionIntent";

export type RiskLevel = "low" | "medium" | "high";
export type PolicyDecision = "passed" | "blocked";

export type RiskFlag = {
  code:
    | "LIMITED_APPROVAL"
    | "UNLIMITED_APPROVAL"
    | "UNVERIFIED_TARGET"
    | "LARGE_TRANSACTION"
    | "TRANSFER"
    | "APPROVAL";
  label: string;
  severity: RiskLevel;
  scoreImpact: number;
};

export type AiRiskExplanation = {
  summary: string;
  reasoning: string[];
  recommendation: string;
};

export type RiskReport = {
  intentHash: `0x${string}`;
  agentId: string;
  walletAddress?: `0x${string}`;
  riskScore: number;
  riskLevel: RiskLevel;
  policyDecision: PolicyDecision;
  flags: RiskFlag[];
  explanation: AiRiskExplanation;
  intent: TransactionIntent;
  policy: PolicyProfile;
};
