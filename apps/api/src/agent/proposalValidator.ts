import type { AgentProposal, RiskReport } from "@nexora/shared";

export function validateProposalRisk(proposal: AgentProposal, report?: RiskReport) {
  if (!report) {
    return false;
  }

  return proposal.intentHash === report.intentHash;
}
