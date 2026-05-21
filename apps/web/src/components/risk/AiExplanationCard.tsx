"use client";

import type { RiskReport } from "@nexora/shared";

type AiExplanationCardProps = {
  report: RiskReport;
};

export function AiExplanationCard({ report }: AiExplanationCardProps) {
  return (
    <section className="ai-explanation-card" aria-label="AI explanation">
      <h3>AI Explanation</h3>
      <p>{report.explanation.summary}</p>
      <ul>
        {report.explanation.reasoning.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p>{report.explanation.recommendation}</p>
    </section>
  );
}
