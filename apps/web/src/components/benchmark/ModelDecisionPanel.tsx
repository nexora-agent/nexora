import type { TransactionIntent } from "@nexora/shared";

type ModelDecisionPanelProps = {
  intent?: TransactionIntent;
};

export function ModelDecisionPanel({ intent }: ModelDecisionPanelProps) {
  const metadata = intent?.metadata;
  if (!metadata?.modelDecisionSource) {
    return null;
  }

  const warnings = metadata.modelGraderWarnings ?? [];

  return (
    <section className="model-decision-card" aria-label="Model decision log">
      <div className="console-topline">
        <span>Model Decision Log</span>
        <span
          className={
            warnings.length > 0
              ? "status-pill status-wrong-network"
              : "status-pill status-ready"
          }
        >
          {metadata.modelDecisionSource === "demo" ? "Demo" : "LLM"}
        </span>
      </div>
      <dl>
        <div>
          <dt>Model</dt>
          <dd>{metadata.modelName ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Parsed Choice</dt>
          <dd>{metadata.modelSelectedVault ?? "No valid choice"}</dd>
        </div>
        <div>
          <dt>Latency</dt>
          <dd>{metadata.modelLatencyMs ? `${metadata.modelLatencyMs}ms` : "—"}</dd>
        </div>
        <div>
          <dt>Verdict</dt>
          <dd>{warnings.length > 0 ? "Warnings found" : "Consistent response"}</dd>
        </div>
      </dl>
      {warnings.length > 0 && (
        <div className="model-warning-list">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <details>
        <summary>Prompt sent to model</summary>
        <pre>{metadata.modelPrompt}</pre>
      </details>
      <details>
        <summary>Raw model response</summary>
        <pre>{metadata.modelRawResponse ?? metadata.modelReasoning}</pre>
      </details>
    </section>
  );
}
