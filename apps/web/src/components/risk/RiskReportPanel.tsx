"use client";

import type { RiskReport } from "@nexora/shared";
import { AiExplanationCard } from "./AiExplanationCard";
import { PolicyDecisionCard } from "./PolicyDecisionCard";
import { RiskFlagsList } from "./RiskFlagsList";
import { RiskScoreCard } from "./RiskScoreCard";

type RiskReportPanelProps = {
  report: RiskReport;
};

export function RiskReportPanel({ report }: RiskReportPanelProps) {
  return (
    <section className="risk-report-panel" aria-label="Risk report">
      <RiskScoreCard report={report} />
      <PolicyDecisionCard report={report} />
      <RiskFlagsList report={report} />
      <AiExplanationCard report={report} />
    </section>
  );
}
