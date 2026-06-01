"use client";

import { useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  benchmarkHash,
  generateBenchmarkFromContract,
  type BenchmarkRiskMode,
  type CustomBenchmarkDefinition,
} from "@/lib/benchmarks/benchmarkDefinition";
import { registerBenchmarkOnchain } from "@/lib/contracts/onchainBenchmarks";
import { isBenchmarkRegistryReady } from "@/lib/contracts/deployments";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

const benchmarkTypes = [
  { label: "DEX Trading", value: "dex-trading" },
  { label: "Yield / Vault", value: "yield" },
  { label: "Custom", value: "custom" },
] as const;

const riskModes: BenchmarkRiskMode[] = ["conservative", "balanced", "aggressive"];

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function BenchmarkBuilder() {
  const { isConnected } = useWalletConnection();
  const [protocolName, setProtocolName] = useState("Custom DEX");
  const [contractAddress, setContractAddress] = useState("");
  const [benchmarkType, setBenchmarkType] =
    useState<CustomBenchmarkDefinition["benchmarkType"]>("dex-trading");
  const [riskMode, setRiskMode] = useState<BenchmarkRiskMode>("conservative");
  const [benchmark, setBenchmark] = useState<CustomBenchmarkDefinition | undefined>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const currentHash = useMemo(() => (benchmark ? benchmarkHash(benchmark) : undefined), [benchmark]);

  const generateBenchmark = () => {
    setError("");
    setNotice("");

    if (!isAddress(contractAddress)) {
      setError("Enter a valid contract address.");
      return;
    }

    setBenchmark(
      generateBenchmarkFromContract({
        contractAddress: contractAddress as Address,
        protocolName,
        riskMode,
        type: benchmarkType,
      }),
    );
  };

  const saveBenchmark = async () => {
    setError("");
    setNotice("");

    if (!benchmark) {
      setError("Generate a benchmark first.");
      return;
    }

    setIsSaving(true);
    try {
      const txHash = await registerBenchmarkOnchain(benchmark);
      setNotice(`Benchmark stored on Mantle: ${shortHash(txHash)}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not store benchmark.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="harness-builder-card" aria-label="Benchmark builder">
      <div className="form-grid">
        <label>
          <span>Protocol Name</span>
          <input
            onChange={(event) => setProtocolName(event.target.value)}
            type="text"
            value={protocolName}
          />
        </label>
        <label>
          <span>Contract Address</span>
          <input
            onChange={(event) => setContractAddress(event.target.value)}
            placeholder="0x..."
            type="text"
            value={contractAddress}
          />
        </label>
        <label>
          <span>Benchmark Type</span>
          <select
            onChange={(event) =>
              setBenchmarkType(event.target.value as CustomBenchmarkDefinition["benchmarkType"])
            }
            value={benchmarkType}
          >
            {benchmarkTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Risk Mode</span>
          <select onChange={(event) => setRiskMode(event.target.value as BenchmarkRiskMode)} value={riskMode}>
            {riskModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="setup-action-row">
        <button className="secondary-action" onClick={generateBenchmark} type="button">
          Generate Benchmark
        </button>
        <button
          className="primary-action"
          disabled={!benchmark || !isConnected || !isBenchmarkRegistryReady() || isSaving}
          onClick={() => void saveBenchmark()}
          type="button"
        >
          {isSaving ? "Storing..." : "Store On-chain"}
        </button>
      </div>

      {!isConnected && <ConnectWalletButton />}
      {!isBenchmarkRegistryReady() && (
        <p className="ownership-note">Deploy the benchmark registry before storing benchmarks.</p>
      )}
      {error && <p className="error-text">{error}</p>}
      {notice && <p className="ownership-note">{notice}</p>}

      {benchmark && (
        <section className="tool-builder-panel" aria-label="Generated benchmark">
          <div className="console-topline">
            <span>{benchmark.name}</span>
            <span className="status-pill status-ready">{currentHash ? shortHash(currentHash) : "Hash ready"}</span>
          </div>
          <p>{benchmark.description}</p>
          <div className="harness-builder-grid">
            <article className="summary-card">
              <h3>Targets</h3>
              <p>{benchmark.targetContracts.join(", ")}</p>
            </article>
            <article className="summary-card">
              <h3>Allowed</h3>
              <ul className="capability-list allowed">
                {benchmark.allowedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </article>
            <article className="summary-card">
              <h3>Blocked</h3>
              <ul className="capability-list restricted">
                {benchmark.blockedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </article>
            <article className="summary-card">
              <h3>Scoring</h3>
              <ul className="capability-list allowed">
                {benchmark.scoringRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      )}
    </section>
  );
}
