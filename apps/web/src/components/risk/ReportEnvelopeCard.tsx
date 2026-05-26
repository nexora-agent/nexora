import type { ReportEnvelope } from "@nexora/shared";

type ReportEnvelopeCardProps = {
  envelope?: ReportEnvelope;
};

function shortHash(hash?: `0x${string}`) {
  if (!hash) {
    return "Not available";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function ReportEnvelopeCard({ envelope }: ReportEnvelopeCardProps) {
  if (!envelope) {
    return null;
  }

  return (
    <section className="onchain-report-card" aria-label="Audit envelope">
      <div className="console-topline">
        <span>Audit Envelope</span>
        <span className="status-pill status-ready">Canonical</span>
      </div>
      <dl>
        <div>
          <dt>Report Hash</dt>
          <dd>{shortHash(envelope.reportHash)}</dd>
        </div>
        <div>
          <dt>Intent Hash</dt>
          <dd>{shortHash(envelope.intentHash)}</dd>
        </div>
        <div>
          <dt>Proposal Hash</dt>
          <dd>{shortHash(envelope.proposalHash)}</dd>
        </div>
        <div>
          <dt>Risk Report Hash</dt>
          <dd>{shortHash(envelope.riskReportHash)}</dd>
        </div>
        <div>
          <dt>Benchmark Hash</dt>
          <dd>{shortHash(envelope.benchmarkHash)}</dd>
        </div>
        <div>
          <dt>Tool Trace Hash</dt>
          <dd>{shortHash(envelope.toolTraceHash)}</dd>
        </div>
      </dl>
    </section>
  );
}
