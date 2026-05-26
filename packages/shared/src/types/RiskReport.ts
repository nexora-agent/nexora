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
    | "APPROVAL"
    | "MNT_TRANSFER"
    | "MNT_VAULT_DEPOSIT"
    | "MNT_VAULT_WITHDRAW"
    | "VERIFIED_BENCHMARK_VAULT"
    | "RISKY_BENCHMARK_VAULT"
    | "VOLATILE_BENCHMARK_VAULT"
    | "AMOUNT_EXCEEDS_BALANCE"
    | "AMOUNT_EXCEEDS_POLICY"
    | "UNKNOWN_PAYABLE_TARGET"
    | "HIGH_APR_WARNING"
    | "LOW_TVL_WARNING"
    | "HIGH_VOLATILITY_WARNING"
    | "SLIPPAGE_WARNING"
    | "APPROVAL_REQUIRED"
    | "BOUNDED_ACTION"
    | "DRY_RUN_ONLY"
    | "LIVE_EXECUTION_DISABLED"
    | "EXTERNAL_DEFI_TARGET";
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
