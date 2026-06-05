"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import {
  readBenchmarksOfOwner,
  type OnchainBenchmark,
} from "@/lib/contracts/onchainBenchmarks";

type Props = {
  connectedAddress?: Address;
  onCreateBenchmark: () => void;
  refreshKey?: number;
};

function decodeBenchmarkMetadata(metadataURI: string) {
  if (!metadataURI.startsWith("data:application/json")) return undefined;

  const [, payload] = metadataURI.split(",", 2);
  if (!payload) return undefined;

  try {
    return JSON.parse(decodeURIComponent(payload)) as {
      benchmarkType?: string;
      description?: string;
      name?: string;
    };
  } catch {
    return undefined;
  }
}

function BenchmarkCard({ benchmark }: { benchmark: OnchainBenchmark }) {
  const shortOwner = `${benchmark.owner.slice(0, 6)}...${benchmark.owner.slice(-4)}`;
  const metadata = decodeBenchmarkMetadata(benchmark.metadataURI);
  const createdDate = new Date(benchmark.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="benchmark-card">
      <div className="benchmark-card-header">
        <span className={`status-pill ${benchmark.active ? "status-ready" : "status-disconnected"}`}>
          {benchmark.active ? "Active" : "Inactive"}
        </span>
        <span className="benchmark-meta">#{benchmark.benchmarkId}</span>
      </div>
      <h3>{metadata?.name ?? `Benchmark #${benchmark.benchmarkId}`}</h3>
      {metadata?.description && <p>{metadata.description}</p>}
      <dl className="benchmark-card-dl">
        {metadata?.benchmarkType && (
          <div>
            <dt>Type</dt>
            <dd>{metadata.benchmarkType}</dd>
          </div>
        )}
        <div>
          <dt>Owner</dt>
          <dd>{shortOwner}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{createdDate}</dd>
        </div>
        {benchmark.targetContracts.length > 0 && (
          <div>
            <dt>Target{benchmark.targetContracts.length > 1 ? "s" : ""}</dt>
            <dd>
              {benchmark.targetContracts.map((addr) => (
                <span key={addr} className="benchmark-address">
                  {`${addr.slice(0, 6)}...${addr.slice(-4)}`}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export function BenchmarkDashboard({ connectedAddress, onCreateBenchmark, refreshKey = 0 }: Props) {
  const [benchmarks, setBenchmarks] = useState<OnchainBenchmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connectedAddress) return;

    setIsLoading(true);
    setError(null);

    readBenchmarksOfOwner(connectedAddress)
      .then(setBenchmarks)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load benchmarks.");
      })
      .finally(() => setIsLoading(false));
  }, [connectedAddress, refreshKey]);

  return (
    <div className="benchmark-dashboard">
      <div className="benchmark-dashboard-header">
        <div>
          <h2>Benchmarks</h2>
          <p>
            Custom on-chain benchmarks define what your smart wallet is tested against.
            Use them to decide which checks the local runner must pass before acting.
          </p>
        </div>
        <button className="primary-action" onClick={onCreateBenchmark} type="button">
          Create Benchmark
        </button>
      </div>

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
            Create a custom benchmark to define what your smart wallet is tested against.
            The runner can then use it as the active test for your agent.
          </p>
          <button className="primary-action" onClick={onCreateBenchmark} type="button">
            Create Benchmark
          </button>
        </section>
      )}

      {connectedAddress && !isLoading && benchmarks.length > 0 && (
        <>
          <div className="benchmark-count-line">
            <span>{benchmarks.length} benchmark{benchmarks.length !== 1 ? "s" : ""} on Mantle Sepolia</span>
          </div>
          <div className="benchmark-grid">
            {benchmarks.map((b) => (
              <BenchmarkCard key={b.benchmarkId} benchmark={b} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
