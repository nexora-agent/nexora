"use client";

import {
  explorerAddressUrl,
  explorerTxUrl,
  getRecordedMantleProofs,
  hasAnyRecordedProof,
} from "@/lib/demo/recordedMantleProofs";

function ProofRow({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value?: string;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd style={{ overflowWrap: "anywhere" }}>
        {href ? (
          <a href={href} rel="noopener noreferrer" target="_blank">
            {value}
          </a>
        ) : (
          <code style={{ overflowWrap: "anywhere" }}>{value}</code>
        )}
      </dd>
    </div>
  );
}

export function RecordedMantleProofs() {
  const proofs = getRecordedMantleProofs();

  return (
    <section className="benchmark-suite-summary" aria-label="Recorded Mantle proofs">
      <div className="console-topline">
        <span>Recorded Mantle Proofs</span>
        <span className="status-pill status-current">Mantle Sepolia</span>
      </div>

      {hasAnyRecordedProof(proofs) ? (
        <dl className="benchmark-card-dl">
          <ProofRow label="Agent ID" value={proofs.agentId} />
          <ProofRow
            href={proofs.smartWallet ? explorerAddressUrl(proofs.smartWallet) : undefined}
            label="Smart wallet"
            value={proofs.smartWallet}
          />
          <ProofRow
            href={
              proofs.benchmarkRegistry
                ? explorerAddressUrl(proofs.benchmarkRegistry)
                : undefined
            }
            label="Benchmark registry"
            value={proofs.benchmarkRegistry}
          />
          <ProofRow
            href={proofs.validationTx ? explorerTxUrl(proofs.validationTx) : undefined}
            label="Validation / preflight transaction"
            value={proofs.validationTx}
          />
          <ProofRow
            href={proofs.executionTx ? explorerTxUrl(proofs.executionTx) : undefined}
            label="Execution transaction"
            value={proofs.executionTx}
          />
          <ProofRow
            href={proofs.reputationTx ? explorerTxUrl(proofs.reputationTx) : undefined}
            label="Reputation transaction"
            value={proofs.reputationTx}
          />
          <ProofRow label="Report hash" value={proofs.reportHash} />
        </dl>
      ) : (
        <p className="ownership-note">
          No recorded proof links configured yet. Run the local live demo and
          add the transaction hashes to Vercel environment variables.
        </p>
      )}
    </section>
  );
}
