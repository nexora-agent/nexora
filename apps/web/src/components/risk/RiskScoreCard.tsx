"use client";

import type { RiskReport } from "@nexora/shared";

type RiskScoreCardProps = {
  report: RiskReport;
};

export function RiskScoreCard({ report }: RiskScoreCardProps) {
  return (
    <section className="risk-score-card" aria-label="Risk score">
      <div className="console-topline">
        <span>Risk Score</span>
        <span className={`status-pill risk-${report.riskLevel}`}>
          {report.riskLevel}
        </span>
      </div>
      <strong>{report.riskScore} / 100</strong>
    </section>
  );
}
