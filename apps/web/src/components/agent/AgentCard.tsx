import type { AgentRecord } from "@nexora/shared";
import Link from "next/link";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { AgentStatusBadge, getAgentStatus } from "./AgentStatusBadge";

type AgentCardProps = {
  agent: AgentRecord;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRiskMode(riskMode: string) {
  return `${riskMode.slice(0, 1).toUpperCase()}${riskMode.slice(1)}`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const status = getAgentStatus(agent);
  const harness = getHarnessTemplate(agent.selectedHarnessId);

  return (
    <article className="agent-card" aria-label={`${agent.name} smart wallet card`}>
      <div className="console-topline">
        <span>Smart Wallet: {agent.name}</span>
        <AgentStatusBadge status={status} />
      </div>

      <dl className="agent-card-grid">
        <div>
          <dt>Harness</dt>
          <dd>{harness.name}</dd>
        </div>
        <div>
          <dt>Smart Wallet</dt>
          <dd>
            {agent.walletAddress ? formatAddress(agent.walletAddress) : "Not created"}
          </dd>
        </div>
        <div>
          <dt>Last Objective</dt>
          <dd>{agent.objectiveRuns?.[0]?.objective ?? "No objective yet"}</dd>
        </div>
        <div>
          <dt>Risk Preview</dt>
          <dd>{formatRiskMode(agent.riskMode)}</dd>
        </div>
        <div>
          <dt>Benchmark Score</dt>
          <dd>{agent.objectiveRuns?.[0]?.benchmarkScore?.finalScore ?? "—"}</dd>
        </div>
      </dl>

      <Link className="secondary-action agent-card-link" href={`/wallets/${agent.id}`}>
        Open
      </Link>
    </article>
  );
}
