"use client";

import type { PolicyProfile } from "@nexora/shared";

type PolicySummaryCardProps = {
  policy: PolicyProfile;
};

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export function PolicySummaryCard({ policy }: PolicySummaryCardProps) {
  return (
    <section className="policy-summary-card" aria-label="Active policy">
      <div className="console-topline">
        <span>Active Policy</span>
        <span className="status-pill status-ready">On-chain ready</span>
      </div>

      <dl>
        <div>
          <dt>Max risk score</dt>
          <dd>{policy.maxRiskScore}</dd>
        </div>
        <div>
          <dt>Max transaction size</dt>
          <dd>{policy.maxTransactionSizeUsd} USDC</dd>
        </div>
        <div>
          <dt>Block unlimited approvals</dt>
          <dd>{yesNo(policy.blockUnlimitedApprovals)}</dd>
        </div>
        <div>
          <dt>Block unverified contracts</dt>
          <dd>{yesNo(policy.blockUnverifiedContracts)}</dd>
        </div>
        <div>
          <dt>Require risk report</dt>
          <dd>{yesNo(policy.requireRiskReport)}</dd>
        </div>
      </dl>
    </section>
  );
}
