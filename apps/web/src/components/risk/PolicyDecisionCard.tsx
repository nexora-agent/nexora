"use client";

import type { RiskReport } from "@nexora/shared";

type PolicyDecisionCardProps = {
  report: RiskReport;
};

export function PolicyDecisionCard({ report }: PolicyDecisionCardProps) {
  return (
    <section className="policy-decision-card" aria-label="Policy decision">
      <div className="console-topline">
        <span>Policy Result</span>
        <span
          className={
            report.policyDecision === "passed"
              ? "status-pill status-ready"
              : "status-pill status-wrong-network"
          }
        >
          {report.policyDecision === "passed" ? "Passed" : "Blocked"}
        </span>
      </div>
    </section>
  );
}
