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
};

function BenchmarkCard({ benchmark }: { benchmark: OnchainBenchmark }) {
  const shortHash = `${benchmark.benchmarkHash.slice(0, 10)}...${benchmark.benchmarkHash.slice(-8)}`;
  const shortOwner = `${benchmark.owner.slice(0, 6)}...${benchmark.owner.slice(-4)}`;
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
      <dl className="benchmark-card-dl">
        <div>
          <dt>Hash</dt>
          <dd title={benchmark.benchmarkHash}>{shortHash}</dd>
        </div>
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
        {benchmark.metadataURI && (
          <div>
            <dt>Metadata</dt>
            <dd className="benchmark-uri">{benchmark.metadataURI.slice(0, 40)}{benchmark.metadataURI.length > 40 ? "…" : ""}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export function BenchmarkDashboard({ connectedAddress, onCreateBenchmark }: Props) {
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
  }, [connectedAddress]);

  return (
    <div className="benchmark-dashboard">
      <div className="benchmark-dashboard-header">
        <div>
          <h2>Benchmarks</h2>
          <p>
            Custom on-chain benchmarks define what your smart wallet is tested against.
            Each benchmark stores a hash on Mantle Sepolia.
          </p>
        </div>
        <button className="primary-action" onClick={onCreateBenchmark} type="button">
          Create Benchmark
        </button>
      </div>

      {!connectedAddress && (
        <section className="empty-state-card" aria-label="Connect wallet prompt">
          <h3>Connect your wallet to view benchmarks</h3>
          <p>Benchmarks are stored on-chain and linked to your wallet address.</p>
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
            The benchmark hash is stored on Mantle Sepolia.
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
