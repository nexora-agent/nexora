"use client";

import type { AgentRecord } from "@nexora/shared";

type AgentProfileCardProps = {
  agent: AgentRecord;
  connectedAddress?: `0x${string}`;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRiskMode(riskMode: string) {
  return `${riskMode.slice(0, 1).toUpperCase()}${riskMode.slice(1)}`;
}

export function AgentProfileCard({
  agent,
  connectedAddress,
}: AgentProfileCardProps) {
  const isOwner =
    connectedAddress?.toLowerCase() === agent.ownerAddress.toLowerCase();

  return (
    <section className="agent-profile-card" aria-label="Agent profile">
      <div className="console-topline">
        <span>Agent ID: {agent.id}</span>
        <span className={isOwner ? "status-pill status-ready" : "status-pill"}>
          {isOwner ? "Owner" : "View only"}
        </span>
      </div>

      <dl>
        <div>
          <dt>Agent Name</dt>
          <dd>{agent.name}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>{agent.goal}</dd>
        </div>
        <div>
          <dt>Risk Mode</dt>
          <dd>{formatRiskMode(agent.riskMode)}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{formatAddress(agent.ownerAddress)}</dd>
        </div>
        <div>
          <dt>Metadata URI</dt>
          <dd>{agent.metadataUri}</dd>
        </div>
      </dl>

      {isOwner ? (
        <button className="secondary-action wallet-disconnect" type="button">
          Edit Agent
        </button>
      ) : (
        <p className="ownership-note">Only the owner wallet can edit this agent.</p>
      )}
    </section>
  );
}
