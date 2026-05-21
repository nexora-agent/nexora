"use client";

import type { AgentRecord, HarnessId } from "@nexora/shared";
import { harnessTemplates } from "@/lib/harness/harnessTemplates";

type ArenaSetupProps = {
  agents: AgentRecord[];
  selectedAgentIds: string[];
  harnessId: HarnessId;
  objective: string;
  onAgentToggle: (agentId: string) => void;
  onHarnessChange: (harnessId: HarnessId) => void;
  onObjectiveChange: (objective: string) => void;
};

export function ArenaSetup({
  agents,
  selectedAgentIds,
  harnessId,
  objective,
  onAgentToggle,
  onHarnessChange,
  onObjectiveChange,
}: ArenaSetupProps) {
  return (
    <section className="arena-setup" aria-label="Arena setup">
      <div>
        <h2>Select Smart Wallets</h2>
        <div className="arena-agent-grid">
          {agents.map((agent) => (
            <label className="choice-card" key={agent.id}>
              <input
                checked={selectedAgentIds.includes(agent.id)}
                onChange={() => onAgentToggle(agent.id)}
                type="checkbox"
              />
              <span>
                <strong>{agent.name}</strong>
                <small>{agent.selectedHarnessId ?? "safe-approval"}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="arena-field">
        <span>Harness</span>
        <select
          onChange={(event) => onHarnessChange(event.target.value as HarnessId)}
          value={harnessId}
        >
          {harnessTemplates.map((harness) => (
            <option key={harness.id} value={harness.id}>
              {harness.name}
            </option>
          ))}
        </select>
      </label>

      <label className="arena-field">
        <span>Shared Objective</span>
        <textarea
          onChange={(event) => onObjectiveChange(event.target.value)}
          value={objective}
        />
      </label>
    </section>
  );
}
