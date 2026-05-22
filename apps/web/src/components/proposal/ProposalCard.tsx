import type { AgentProposal } from "@nexora/shared";

type ProposalCardProps = {
  proposal: AgentProposal;
};

function shortHex(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  return (
    <section className="proposal-card" aria-label="Smart wallet proposal">
      <div className="console-topline">
        <span>Smart Wallet Proposal</span>
        <span className="status-pill status-ready">Intent linked</span>
      </div>
      <dl>
        <div>
          <dt>Action Type</dt>
          <dd>{proposal.actionType}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{shortHex(proposal.target)}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>{proposal.token}</dd>
        </div>
        {proposal.targetVault && (
          <div>
            <dt>Selected Vault</dt>
            <dd>{proposal.targetVault}</dd>
          </div>
        )}
        {proposal.rejectedOptions?.length ? (
          <div>
            <dt>Rejected Vaults</dt>
            <dd>
              {proposal.rejectedOptions
                .map((option) => `${option.name}: ${option.reason}`)
                .join(" · ")}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Amount</dt>
          <dd>{proposal.amount}</dd>
        </div>
        <div>
          <dt>Intent Hash</dt>
          <dd>{shortHex(proposal.intentHash)}</dd>
        </div>
        <div>
          <dt>Reasoning</dt>
          <dd>{proposal.reasoning}</dd>
        </div>
      </dl>
    </section>
  );
}
