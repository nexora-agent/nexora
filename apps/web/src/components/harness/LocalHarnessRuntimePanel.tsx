"use client";

import type { AgentRecord, HarnessTemplate } from "@nexora/shared";
import { useState } from "react";
import { getAgentPolicy } from "@/lib/agents/localAgentRegistry";
import {
  type LocalHarnessRunResult,
  type LocalHarnessRunLogEntry,
  listLocalHarnessRuns,
  testLocalHarnessRuntime,
} from "@/lib/harness/localHarnessRuntime";

type LocalHarnessRuntimePanelProps = {
  agent: AgentRecord;
  harness: HarnessTemplate;
};

export function LocalHarnessRuntimePanel({
  agent,
  harness,
}: LocalHarnessRuntimePanelProps) {
  const [endpointUrl, setEndpointUrl] = useState(
    harness.localRuntimeUrl ?? "http://127.0.0.1:8787/nexora/run",
  );
  const [runtimeSecret, setRuntimeSecret] = useState(
    harness.localRuntimeSecret ?? "",
  );
  const [objective, setObjective] = useState(
    "Choose the safest 0.01 MNT benchmark vault.",
  );
  const [error, setError] = useState("");
  const [history, setHistory] = useState<LocalHarnessRunLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<LocalHarnessRunResult>();

  const runTest = async () => {
    setError("");
    setResult(undefined);
    setIsRunning(true);

    try {
      setResult(
        await testLocalHarnessRuntime({
          agent,
          endpointUrl,
          harness: {
            ...harness,
            localRuntimeSecret: runtimeSecret,
            localRuntimeUrl: endpointUrl,
          },
          objective,
          policy: getAgentPolicy(agent),
        }),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not reach local harness.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const loadHistory = async () => {
    setError("");

    try {
      const response = await listLocalHarnessRuns();
      setHistory(response.runs);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load local harness runs.",
      );
    }
  };

  return (
    <section className="summary-card local-harness-panel" aria-label="Local harness runtime">
      <h3>Local Harness Runtime</h3>
      <label>
        <span>Endpoint</span>
        <input
          aria-label="Local harness endpoint"
          onChange={(event) => setEndpointUrl(event.target.value)}
          type="url"
          value={endpointUrl}
        />
      </label>
      <label>
        <span>Shared Secret</span>
        <input
          aria-label="Local harness shared secret"
          onChange={(event) => setRuntimeSecret(event.target.value)}
          placeholder="Optional"
          type="password"
          value={runtimeSecret}
        />
      </label>
      <label>
        <span>Objective</span>
        <textarea
          aria-label="Local harness objective"
          onChange={(event) => setObjective(event.target.value)}
          value={objective}
        />
      </label>
      <button
        className="primary-action"
        disabled={isRunning || !endpointUrl}
        onClick={() => void runTest()}
        type="button"
      >
        {isRunning ? "Testing..." : "Test Local Harness"}
      </button>
      <button className="secondary-action" onClick={() => void loadHistory()} type="button">
        Load Run History
      </button>
      {error && <p className="error-text">{error}</p>}
      {result && (
        <details className="setup-detail-card" open>
          <summary>
            {result.mode} · {result.latencyMs}ms · {result.auth?.signed ? "signed" : "unsigned"}
          </summary>
          <dl>
            <dt>Run ID</dt>
            <dd>{result.runId ?? "—"}</dd>
            <dt>Manifest</dt>
            <dd>{result.toolManifest?.hash ?? "—"}</dd>
            <dt>Used Tools</dt>
            <dd>{result.usedTools?.length ? result.usedTools.join(", ") : "Not reported"}</dd>
          </dl>
          <pre>{JSON.stringify(result.response, null, 2)}</pre>
        </details>
      )}
      {history.length > 0 && (
        <div className="local-harness-history">
          {history.map((entry) => (
            <div key={entry.runId}>
              <strong>{entry.status}</strong>
              <span>{entry.harnessId}</span>
              <span>{entry.latencyMs}ms</span>
              <span>{entry.usedTools.length ? entry.usedTools.join(", ") : "no tools reported"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
