import type { RiskReport } from "@nexora/shared";

export function scoreRisk(report?: RiskReport) {
  if (!report) {
    return 0;
  }

  return Math.max(0, 100 - report.riskScore);
}
