"use client";

import type { RiskReport } from "@nexora/shared";

type RiskFlagsListProps = {
  report: RiskReport;
};

export function RiskFlagsList({ report }: RiskFlagsListProps) {
  return (
    <section className="risk-flags-card" aria-label="Risk flags">
      <h3>Risk Flags</h3>
      <ul>
        {report.flags.map((flag) => (
          <li key={flag.code}>
            <span>{flag.label}</span>
            <strong>+{flag.scoreImpact}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
