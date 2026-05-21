import type {
  PolicyDecision,
  PolicyProfile,
  RiskReport,
  TransactionIntent,
} from "@nexora/shared";
import { explainRiskReport } from "../agent/nexoraAgent";
import { riskLevelForScore } from "./riskLevels";
import { evaluateRiskRules } from "./riskRules";
import { scoreRisk } from "./riskScoring";

export function analyzeRisk(
  intent: TransactionIntent,
  policy: PolicyProfile,
  walletAddress?: `0x${string}`,
): RiskReport {
  const flags = evaluateRiskRules(intent, policy);
  const riskScore = scoreRisk(flags);
  const policyDecision: PolicyDecision =
    riskScore <= policy.maxRiskScore &&
    !(
      policy.blockUnlimitedApprovals &&
      flags.some((flag) => flag.code === "UNLIMITED_APPROVAL")
    ) &&
    !(
      policy.blockUnverifiedContracts &&
      flags.some((flag) => flag.code === "UNVERIFIED_TARGET")
    )
      ? "passed"
      : "blocked";

  return {
    agentId: intent.agentId,
    explanation: explainRiskReport(riskScore, policyDecision, flags),
    flags,
    intent,
    intentHash: intent.intentHash,
    policy,
    policyDecision,
    riskLevel: riskLevelForScore(riskScore),
    riskScore,
    walletAddress,
  };
}
