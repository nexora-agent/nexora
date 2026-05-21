import type { OnchainReportRecord } from "@nexora/shared";
import { mantleSepolia } from "@/lib/chains/mantle";
import { ReportHashViewer } from "./ReportHashViewer";
import { SaveOnchainReportButton } from "./SaveOnchainReportButton";

type OnchainReportCardProps = {
  record?: OnchainReportRecord;
};

export function OnchainReportCard({ record }: OnchainReportCardProps) {
  if (!record) {
    return null;
  }

  const explorerUrl = record.registryAddress
    ? `${mantleSepolia.blockExplorers.default.url}/address/${record.registryAddress}`
    : mantleSepolia.blockExplorers.default.url;

  return (
    <section className="onchain-report-card" aria-label="On-chain report">
      <div className="console-topline">
        <span>On-Chain Risk Registry Record</span>
        <span className="status-pill status-ready">Registry ready</span>
      </div>
      <dl>
        <div>
          <dt>Wallet ID</dt>
          <dd>{record.agentId}</dd>
        </div>
        <div>
          <dt>Harness ID</dt>
          <dd>{record.harnessId}</dd>
        </div>
        <div>
          <dt>Risk Score</dt>
          <dd>{record.riskScore}</dd>
        </div>
        <div>
          <dt>Benchmark Score</dt>
          <dd>{record.benchmarkScore}</dd>
        </div>
        <ReportHashViewer reportHash={record.reportHash} />
      </dl>
      <a className="secondary-action" href={explorerUrl} rel="noreferrer" target="_blank">
        Open Registry Explorer
      </a>
      <SaveOnchainReportButton record={record} />
    </section>
  );
}
