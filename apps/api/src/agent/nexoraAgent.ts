import type { AiRiskExplanation, PolicyDecision, RiskFlag } from "@nexora/shared";

export function explainRiskReport(
  riskScore: number,
  policyDecision: PolicyDecision,
  flags: RiskFlag[],
): AiRiskExplanation {
  const majorFlags = flags
    .filter((flag) => flag.severity !== "low")
    .map((flag) => flag.label);

  return {
    summary:
      policyDecision === "passed"
        ? `Risk score ${riskScore}/100. The action passes the active policy.`
        : `Risk score ${riskScore}/100. The action is blocked by the active policy.`,
    reasoning:
      majorFlags.length > 0
        ? majorFlags
        : ["No high-severity deterministic risk flags were found."],
    recommendation:
      policyDecision === "passed"
        ? "Proceed only after confirming the target address and amount."
        : "Do not execute this action unless the policy or transaction is changed.",
  };
}
