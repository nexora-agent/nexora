import type { AgentProposal, RiskReport } from "@nexora/shared";

export function scoreOutcome(proposal?: AgentProposal, report?: RiskReport) {
  if (!proposal || !report) {
    return 0;
  }

  return proposal.intentHash === report.intentHash ? 95 : 35;
}
