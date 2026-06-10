"use client";

import { useState } from "react";
import {
  runHostedBenchmarkPreview,
  type HostedBenchmarkPreviewResult,
} from "@/lib/demo/runHostedBenchmarkPreview";

export function HostedBenchmarkPreview() {
  const [result, setResult] = useState<HostedBenchmarkPreviewResult | undefined>();

  return (
    <section className="benchmark-lab-shell" aria-label="Hosted benchmark preview">
      <div className="benchmark-lab-hero">
        <div>
          <span className="status-pill status-current">Hosted preview</span>
          <h3>Deterministic Benchmark Preview</h3>
          <p>
            Run the Safe MNT Yield Benchmark as a deterministic browser preview.
            No private keys, no live transactions. Run locally for live
            autonomous execution.
          </p>
        </div>
        <button
          className="primary-action benchmark-run-button"
          onClick={() => setResult(runHostedBenchmarkPreview())}
          type="button"
        >
          Run Hosted Preview
        </button>
      </div>

      {result && (
        <>
          <section className="benchmark-suite-summary" aria-label="Hosted preview outcome">
            <div className="console-topline">
              <span>Mode: Hosted preview</span>
              <span className="status-pill status-ready">
                {result.benchmarkName}
              </span>
            </div>
            <div className="suite-result-grid">
              <article>
                <strong>Agent decision</strong>
                <span>Execute</span>
                <small>Preview-only execution</small>
              </article>
              <article>
                <strong>Selected target</strong>
                <span>{result.selectedTarget}</span>
                <small>
                  Rejected: {result.rejectedTargets.join(", ")}
                </small>
              </article>
              <article>
                <strong>Risk score</strong>
                <span>{result.riskScore} / 100</span>
                <small>Policy: {result.policyDecision}</small>
              </article>
              <article>
                <strong>Benchmark score</strong>
                <span>{result.benchmarkScore.finalScore} / 100</span>
                <small>
                  Safety {result.benchmarkScore.safetyScore} · Policy{" "}
                  {result.benchmarkScore.policyComplianceScore} · Tools{" "}
                  {result.benchmarkScore.toolUseScore}
                </small>
              </article>
            </div>
          </section>

          <section className="benchmark-suite-summary" aria-label="Hosted preview tool trace">
            <div className="console-topline">
              <span>Tool Trace</span>
              <span className="status-pill status-current">
                {result.toolTrace.length} tool calls
              </span>
            </div>
            <ol className="tool-trace-list" style={{ margin: 0, paddingLeft: "20px" }}>
              {result.toolTrace.map((entry) => (
                <li key={entry.index} style={{ marginBottom: "6px" }}>
                  <strong>{entry.toolName}</strong> — {entry.status}
                  <br />
                  <small>{entry.summary}</small>
                </li>
              ))}
            </ol>
          </section>

          <section className="benchmark-suite-summary" aria-label="Hosted preview report hash">
            <div className="console-topline">
              <span>Report Hash</span>
            </div>
            <code style={{ overflowWrap: "anywhere" }}>{result.reportHash}</code>
            <p className="ownership-note">
              Preview-only execution. This result was computed deterministically
              in your browser and was not executed on-chain. Live autonomous
              execution runs from the local operator runner and records results
              on Mantle.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
