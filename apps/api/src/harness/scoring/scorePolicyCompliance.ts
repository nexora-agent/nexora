import type { RiskReport } from "@nexora/shared";

export function scorePolicyCompliance(report?: RiskReport) {
  return report?.policyDecision === "passed" ? 100 : 20;
}
