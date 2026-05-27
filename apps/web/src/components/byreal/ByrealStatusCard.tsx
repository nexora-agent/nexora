import type { ByrealStatus } from "@/lib/byreal/byrealAdapter";

type ByrealStatusCardProps = {
  status: ByrealStatus;
  eligibilityLabel?: string;
  eligibilityReason?: string;
};

const modeLabels: Record<ByrealStatus["mode"], string> = {
  api_read_only: "API read-only",
  cli_dry_run: "CLI preview",
  cli_live: "CLI live",
  cli_read_only: "CLI read-only",
  demo: "Demo adapter",
  disabled: "Disabled",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not checked";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ByrealStatusCard({
  eligibilityLabel,
  eligibilityReason,
  status,
}: ByrealStatusCardProps) {
  const executionLabel =
    status.executionMode === "dry_run"
      ? "External DeFi Preview"
      : status.executionMode === "live"
        ? "Live local CLI"
      : status.executionMode === "read_only"
        ? "Read-only"
        : "Disabled";
  const toolCount = status.supportedTools.length;

  return (
    <section className="summary-card byreal-status-card">
      <div className="card-heading-row">
        <h3>RealClaw / Byreal Status</h3>
        <span className={`status-pill status-${status.mode.replaceAll("_", "-")}`}>
          {modeLabels[status.mode]}
        </span>
      </div>

      <p>{status.operatorMessage}</p>

      <dl>
        <div>
          <dt>Adapter</dt>
          <dd>{modeLabels[status.adapterMode]}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>{executionLabel}</dd>
        </div>
        <div>
          <dt>Live Execution</dt>
          <dd>{status.executionEnabled ? "Enabled locally" : "Disabled"}</dd>
        </div>
        <div>
          <dt>CLI</dt>
          <dd>
            {status.installed
              ? `${status.binaryName ?? "byreal-cli"} ${status.version ?? ""}`.trim()
              : "Not detected"}
          </dd>
        </div>
        <div>
          <dt>CLI Wallet</dt>
          <dd>{status.walletConfigured ? "Configured locally" : "Not configured"}</dd>
        </div>
        <div>
          <dt>API</dt>
          <dd>{status.apiConfigured ? "Configured" : "Not configured"}</dd>
        </div>
        <div>
          <dt>Tools</dt>
          <dd>{toolCount ? `${toolCount} available` : "Demo-only fallback"}</dd>
        </div>
        <div>
          <dt>Last Check</dt>
          <dd>{formatDate(status.lastCheckedAt)}</dd>
        </div>
        {eligibilityLabel && (
          <div>
            <dt>External DeFi</dt>
            <dd>{eligibilityLabel}</dd>
          </div>
        )}
      </dl>

      {eligibilityReason && <span>{eligibilityReason}</span>}

      {status.errors.length > 0 && (
        <ul>
          {status.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
