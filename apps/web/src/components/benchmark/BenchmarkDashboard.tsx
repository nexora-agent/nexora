"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import {
  readBenchmarksOfOwner,
  type OnchainBenchmark,
} from "@/lib/contracts/onchainBenchmarks";
import { RunnerModelSetupCard } from "@/components/runner/RunnerModelSetupCard";

type Props = {
  connectedAddress?: Address;
  onCreateBenchmark: () => void;
  refreshKey?: number;
};

function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function JsonModal({
  onClose,
  title,
  value,
}: {
  onClose: () => void;
  title: string;
  value: unknown | null;
}) {
  useEffect(() => {
    if (!value) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, value]);

  if (!value) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label={title}
        aria-modal="true"
        className="wallet-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-topline">
          <h2>{title}</h2>
          <button className="secondary-action" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <pre className="benchmark-json-preview">
          {JSON.stringify(value, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function BenchmarkCard({
  benchmark,
  onViewJson,
}: {
  benchmark: OnchainBenchmark;
  onViewJson: () => void;
}) {
  const createdDate = new Date(benchmark.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const isExecutable = benchmark.targetContracts.length > 0;

  return (
    <button
      className="benchmark-card benchmark-card-button"
      onClick={onViewJson}
      type="button"
    >
      <div className="benchmark-card-header">
        <div className="benchmark-card-pills">
          <span
            className={`status-pill ${
              benchmark.active ? "status-ready" : "status-disconnected"
            }`}
          >
            {/* {benchmark.active ? "Active" : "Inactive"} */}
          </span>

          <span
            className={`status-pill ${
              isExecutable ? "status-running" : "status-idle"
            }`}
          >
            {isExecutable ? "Executable" : ""}
          </span>
        </div>

        <span className="benchmark-meta">#{benchmark.benchmarkId}</span>
      </div>

      <h3>{benchmark.name || `Benchmark #${benchmark.benchmarkId}`}</h3>

      {benchmark.description && (
        <p className="benchmark-card-description">{benchmark.description}</p>
      )}

      <dl className="benchmark-card-dl">
        {benchmark.benchmarkType && (
          <div>
            <dt>Type</dt>
            <dd>{benchmark.benchmarkType}</dd>
          </div>
        )}

        <div>
          <dt>Created</dt>
          <dd>{createdDate}</dd>
        </div>

        {isExecutable && (
          <div>
            <dt>Target{benchmark.targetContracts.length > 1 ? "s" : ""}</dt>
            <dd>
              {benchmark.targetContracts.map((addr) => (
                <span className="benchmark-address" key={addr}>
                  {`${addr.slice(0, 6)}...${addr.slice(-4)}`}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="benchmark-card-footer">
        <span>Stored on Mantle</span>
        <strong>View JSON</strong>
      </div>
    </button>
  );
}

export function BenchmarkDashboard({
  connectedAddress,
  onCreateBenchmark,
  refreshKey = 0,
}: Props) {
  const [benchmarks, setBenchmarks] = useState<OnchainBenchmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBenchmarkJson, setSelectedBenchmarkJson] =
    useState<unknown | null>(null);
  const [selectedBenchmarkTitle, setSelectedBenchmarkTitle] =
    useState("Benchmark");

  const closeSelectedBenchmark = () => {
    setSelectedBenchmarkJson(null);
    setSelectedBenchmarkTitle("Benchmark");
  };

  useEffect(() => {
    if (!connectedAddress) return;

    setIsLoading(true);
    setError(null);

    readBenchmarksOfOwner(connectedAddress)
      .then(setBenchmarks)
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load benchmarks."
        );
      })
      .finally(() => setIsLoading(false));
  }, [connectedAddress, refreshKey]);

  return (
    <div className="benchmark-dashboard">
      <div className="benchmark-dashboard-header">
        <div>
          <h2>Benchmarks</h2>
          <p>
            Custom on-chain benchmarks define what your smart wallet is tested
            against. Use them to decide which checks the local runner must pass
            before acting.
          </p>
        </div>

        <button
          className="primary-action"
          onClick={onCreateBenchmark}
          type="button"
        >
          Create Benchmark
        </button>
      </div>

      <RunnerModelSetupCard
        compact
        description="AI model used to generate and score benchmarks. Test the connection before creating a benchmark."
        title="AI Setup"
      />

      {!connectedAddress && (
        <section className="empty-state-card" aria-label="Connect wallet prompt">
          <h3>Connect your wallet to view benchmarks</h3>
          <p>Benchmarks are linked to your connected wallet on Mantle Sepolia.</p>
        </section>
      )}

      {connectedAddress && isLoading && (
        <section className="benchmark-grid" aria-label="Loading benchmarks">
          {Array.from({ length: 2 }).map((_, i) => (
            <article key={i} className="benchmark-card benchmark-card-skeleton">
              <span className="skeleton-line skeleton-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-short" />
            </article>
          ))}
        </section>
      )}

      {connectedAddress && !isLoading && error && (
        <p className="error-text">{error}</p>
      )}

      {connectedAddress && !isLoading && !error && benchmarks.length === 0 && (
        <section className="empty-state-card" aria-label="No benchmarks">
          <h3>No benchmarks yet</h3>
          <p>
            Create a custom benchmark to define what your smart wallet is tested
            against. The runner can then use it as the active test for your
            agent.
          </p>

          <button
            className="primary-action"
            onClick={onCreateBenchmark}
            type="button"
          >
            Create Benchmark
          </button>
        </section>
      )}

      {connectedAddress && !isLoading && benchmarks.length > 0 && (
        <>
          <div className="benchmark-count-line">
            <span>
              Created Benchmarks · {benchmarks.length} on Mantle Sepolia
            </span>
          </div>

          <div className="benchmark-grid">
            {benchmarks.map((benchmark) => (
              <BenchmarkCard
                benchmark={benchmark}
                key={benchmark.benchmarkId}
                onViewJson={() => {
                  setSelectedBenchmarkTitle(
                    benchmark.name?.trim() ||
                      `Benchmark #${benchmark.benchmarkId}`
                  );

                  setSelectedBenchmarkJson({
                    benchmarkJson: benchmark.benchmarkDataJson
                      ? parseJsonSafely(benchmark.benchmarkDataJson)
                      : undefined,
                    benchmarkState: benchmark,
                    source: "mantle",
                  });
                }}
              />
            ))}
          </div>
        </>
      )}

      <JsonModal
        onClose={closeSelectedBenchmark}
        title={selectedBenchmarkTitle}
        value={selectedBenchmarkJson}
      />
    </div>
  );
}