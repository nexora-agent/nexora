import type { AgentRecord } from "@nexora/shared";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";

type AgentCapabilityCardProps = {
  agent: AgentRecord;
};

export function AgentCapabilityCard({ agent }: AgentCapabilityCardProps) {
  const harness = getHarnessTemplate(agent.selectedHarnessId);

  return (
    <section className="agent-capability-card" aria-label="Smart wallet capabilities">
      <div className="console-topline">
        <span>Capabilities</span>
        <span className="status-pill status-ready">{harness.tools.length} tools</span>
      </div>
      <div className="capability-grid">
        <section>
          <h3>This smart wallet can</h3>
          <ul>
            <li>Use selected harness tools</li>
            <li>Read wallet balance</li>
            <li>Create transaction proposals</li>
            <li>Analyze risk</li>
            <li>Run benchmark tasks</li>
          </ul>
        </section>
        <section>
          <h3>This smart wallet cannot</h3>
          <ul>
            <li>Spend from your main wallet</li>
            <li>Execute without policy checks</li>
            <li>Use blocked action types</li>
            <li>Bypass risk reports</li>
          </ul>
        </section>
      </div>
    </section>
  );
}
