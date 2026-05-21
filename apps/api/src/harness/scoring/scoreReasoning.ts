import type { AgentProposal } from "@nexora/shared";

export function scoreReasoning(proposal?: AgentProposal) {
  if (!proposal?.reasoning) {
    return 0;
  }

  return proposal.reasoning.length >= 80 ? 90 : 70;
}
