import type { AgentProposal, RiskReport } from "@nexora/shared";

type ProposalRiskPanelProps = {
  proposal: AgentProposal;
  report?: RiskReport;
};

export function ProposalRiskPanel({ proposal, report }: ProposalRiskPanelProps) {
  const isLinked = report?.intentHash === proposal.intentHash;

  return (
    <section className="proposal-risk-panel" aria-label="Proposal risk">
      <div className="console-topline">
        <span>Proposal Risk Link</span>
        <span className={isLinked ? "status-pill status-ready" : "status-pill risk-high"}>
          {isLinked ? "Verified" : "Missing"}
        </span>
      </div>
      <dl>
        <div>
          <dt>Risk Score</dt>
          <dd>{isLinked ? report.riskScore : "—"}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>{isLinked ? report.policyDecision : "Missing"}</dd>
        </div>
      </dl>
    </section>
  );
}
