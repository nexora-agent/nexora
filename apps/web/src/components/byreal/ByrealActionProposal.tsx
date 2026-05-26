import type { AgentProposal } from "@nexora/shared";

type ByrealActionProposalProps = {
  proposal: AgentProposal;
};

export function ByrealActionProposal({ proposal }: ByrealActionProposalProps) {
  return (
    <section className="byreal-action-proposal" aria-label="Byreal action proposal">
      <h3>DeFi Action</h3>
      <dl>
        <div>
          <dt>Action</dt>
          <dd>{proposal.actionType}</dd>
        </div>
        <div>
          <dt>Pool</dt>
          <dd>{proposal.poolName ?? "Byreal / RealClaw dry-run"}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{proposal.mode ?? "demo"} · {proposal.executionMode ?? "dry_run"}</dd>
        </div>
        <div>
          <dt>Live Execution</dt>
          <dd>{proposal.liveExecutionEnabled ? "Enabled" : "Disabled"}</dd>
        </div>
        <div>
          <dt>Intent Hash</dt>
          <dd>{proposal.intentHash}</dd>
        </div>
      </dl>
    </section>
  );
}
