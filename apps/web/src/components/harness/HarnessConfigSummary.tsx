import type { HarnessTemplate } from "@nexora/shared";

type HarnessConfigSummaryProps = {
  harness: HarnessTemplate;
};

export function HarnessConfigSummary({ harness }: HarnessConfigSummaryProps) {
  return (
    <section className="harness-summary" aria-label="Harness configuration summary">
      <dl>
        <div>
          <dt>Allowed Actions</dt>
          <dd>{harness.allowedActionTypes.join(", ")}</dd>
        </div>
        <div>
          <dt>Execution Permissions</dt>
          <dd>{harness.executionPermissions.join(", ")}</dd>
        </div>
        <div>
          <dt>Required Reports</dt>
          <dd>{harness.requiredReports.join(", ")}</dd>
        </div>
      </dl>
    </section>
  );
}
