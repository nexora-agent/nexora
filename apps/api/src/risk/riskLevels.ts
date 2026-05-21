import type { RiskLevel } from "@nexora/shared";

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 80) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

  return "low";
}
