import type { HarnessTemplate } from "@nexora/shared";
import { HarnessConfigSummary } from "./HarnessConfigSummary";

type HarnessDetailPanelProps = {
  harness: HarnessTemplate;
};

export function HarnessDetailPanel({ harness }: HarnessDetailPanelProps) {
  return (
    <section className="harness-detail-panel" aria-label="Harness details">
      <div className="console-topline">
        <span>{harness.name}</span>
        <span className="status-pill status-ready">Harness</span>
      </div>

      <HarnessConfigSummary harness={harness} />

      <div className="harness-detail-grid">
        <section aria-label="Harness tools">
          <h3>Tools</h3>
          <ul>
            {harness.tools.map((tool) => (
              <li key={tool.id}>
                <strong>{tool.name}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Blocked actions">
          <h3>Blocked Actions</h3>
          <ul>
            {harness.blockedActionTypes.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </section>

        <section aria-label="Scoring rules">
          <h3>Scoring Rules</h3>
          <ul>
            {harness.scoringRules.map((rule) => (
              <li key={rule.id}>
                <strong>
                  {rule.label} · {rule.weight}%
                </strong>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Risk rules">
          <h3>Risk Rules</h3>
          <ul>
            {harness.riskRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
