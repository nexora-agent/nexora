"use client";

import type { AgentRecord } from "@nexora/shared";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  readActiveBenchmarkForAgent,
  readBenchmarksOfOwner,
  selectBenchmarkForAgentOnchain,
  type OnchainBenchmark,
} from "@/lib/contracts/onchainBenchmarks";
import {
  isAgentWalletDeploymentReady,
  isBenchmarkRegistryReady,
} from "@/lib/contracts/deployments";
import {
  readAllowedAddressOnchain,
  readAutonomyStateOnchain,
  saveExecutorPolicyOnchain,
  setAllowedAddressOnchain,
  type AutonomyOnchainState,
} from "@/lib/contracts/onchainAutonomy";

type AutonomyControlsProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onSaved: (agent: AgentRecord) => void;
};

type AllowedAddressRow = {
  address: Address;
  allowed?: boolean;
  label: string;
  txHash?: `0x${string}`;
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function formatAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function benchmarkLabel(benchmark: OnchainBenchmark) {
  return benchmark.name || `Benchmark #${benchmark.benchmarkId}`;
}

function CardSkeleton() {
  return (
    <section className="summary-card skeleton-card" aria-label="Loading">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-short" />
    </section>
  );
}

export function AutonomyControls({
  agent,
  isOwner,
  onSaved,
}: AutonomyControlsProps) {
  const [dailyLimit, setDailyLimit] = useState(
    agent.autonomy?.dailyLimit ?? "0.05",
  );
  const [executor, setExecutor] = useState(
    agent.autonomy?.executorAddress ?? "",
  );
  const [maxAction, setMaxAction] = useState(
    agent.autonomy?.maxValuePerAction ?? "0.01",
  );
  const [validForHours, setValidForHours] = useState(24);
  const [newAllowedAddress, setNewAllowedAddress] = useState("");
  const [benchmarks, setBenchmarks] = useState<OnchainBenchmark[]>([]);
  const [activeBenchmarkId, setActiveBenchmarkId] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isLoadingBenchmarks, setIsLoadingBenchmarks] = useState(false);
  const [onchainState, setOnchainState] = useState<
    AutonomyOnchainState | undefined
  >();
  const [executorEdited, setExecutorEdited] = useState(false);

  const isIdentityWallet = agent.identityStandard === "erc-8004";
  const isAutonomyReady = isAgentWalletDeploymentReady();
  const isBenchmarkReady = isBenchmarkRegistryReady();
  const agentId = agent.agentIdentityId ?? agent.id;

  const activeBenchmark = benchmarks.find(
    (benchmark) => String(benchmark.benchmarkId) === String(activeBenchmarkId),
  );

  const executorConfigured =
    Boolean(onchainState?.enabled) &&
    Boolean(onchainState?.reporterAuthorized) &&
    onchainState?.executor.toLowerCase() !== zeroAddress;

  const allowedAddresses = useMemo<AllowedAddressRow[]>(() => {
    const byAddress = new Map<string, AllowedAddressRow>();

    onchainState?.benchmarkVaults.forEach((vault) => {
      byAddress.set(vault.address.toLowerCase(), {
        address: vault.address,
        allowed: vault.targetAllowed,
        label: vault.label,
      });
    });

    onchainState?.allowedTargets.forEach((target) => {
      byAddress.set(target.address.toLowerCase(), target);
    });

    return Array.from(byAddress.values());
  }, [onchainState]);

  const refreshOnchainState = async () => {
    if (!agent.walletAddress || !isIdentityWallet || !isAutonomyReady) {
      return;
    }

    setIsLoadingState(true);
    setNotice("");

    try {
      const state = await readAutonomyStateOnchain({
        agentId,
        executor: isAddress(executor) ? executor : undefined,
        walletAddress: agent.walletAddress,
      });

      setOnchainState(state);

      if (state) {
        if (!executorEdited && state.executor.toLowerCase() !== zeroAddress) {
          setExecutor(state.executor);
        }

        setDailyLimit(state.dailyLimitMnt);
        setMaxAction(state.maxValuePerActionMnt);
      }
    } catch {
      setNotice("Could not read executor settings from this smart wallet.");
    } finally {
      setIsLoadingState(false);
    }
  };

  const refreshBenchmarks = async () => {
    if (!isBenchmarkReady) {
      return;
    }

    setIsLoadingBenchmarks(true);

    try {
      const [ownedBenchmarks, appliedBenchmark] = await Promise.all([
        readBenchmarksOfOwner(agent.ownerAddress),
        readActiveBenchmarkForAgent(agentId).catch(() => undefined),
      ]);

      const mergedBenchmarks = appliedBenchmark
        ? [
            appliedBenchmark,
            ...ownedBenchmarks.filter(
              (benchmark) =>
                String(benchmark.benchmarkId) !==
                String(appliedBenchmark.benchmarkId),
            ),
          ]
        : ownedBenchmarks;

      setBenchmarks(mergedBenchmarks);
      setActiveBenchmarkId(
        appliedBenchmark ? String(appliedBenchmark.benchmarkId) : "",
      );
    } catch {
      setBenchmarks([]);
      setActiveBenchmarkId("");
    } finally {
      setIsLoadingBenchmarks(false);
    }
  };

  useEffect(() => {
    void refreshOnchainState();
  }, [agent.walletAddress, agentId, isAutonomyReady, isIdentityWallet]);

  useEffect(() => {
    void refreshBenchmarks();
  }, [agent.ownerAddress, agentId, isBenchmarkReady]);

  const savePolicy = async () => {
    setNotice("");

    if (!agent.walletAddress) {
      setNotice("Create a smart wallet before setting executor access.");
      return;
    }

    if (!isOwner) {
      setNotice("Only the smart wallet owner can update executor access.");
      return;
    }

    if (!isAddress(executor)) {
      setNotice("Enter a valid executor address.");
      return;
    }

    setIsSaving(true);
    setNotice("Waiting for MetaMask confirmation...");

    try {
      await saveExecutorPolicyOnchain({
        agentId,
        dailyLimitMnt: dailyLimit,
        enabled: true,
        executor,
        maxValuePerActionMnt: maxAction,
        validForHours,
        walletAddress: agent.walletAddress,
      });

      onSaved({
        ...agent,
        autonomy: {
          ...agent.autonomy,
          dailyLimit,
          enabled: true,
          executorAddress: executor,
          maxValuePerAction: maxAction,
          validUntil: new Date(
            Date.now() + validForHours * 60 * 60 * 1000,
          ).toISOString(),
        },
      });

      await refreshOnchainState();
      setNotice("Executor access stored on-chain.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not save executor address.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addAllowedAddress = async () => {
    setNotice("");

    if (!agent.walletAddress) {
      setNotice("Create a smart wallet before adding allowed targets.");
      return;
    }

    if (!isIdentityWallet) {
      setNotice("This smart wallet does not support autonomy controls.");
      return;
    }

    if (!isAutonomyReady) {
      setNotice("Agent wallet contracts are not configured for this frontend.");
      return;
    }

    if (!isOwner) {
      setNotice("Only the smart wallet owner can add allowed targets.");
      return;
    }

    if (!isAddress(newAllowedAddress)) {
      setNotice("Enter a valid contract address.");
      return;
    }

    const target = newAllowedAddress as Address;

    setIsSaving(true);
    setNotice("Waiting for MetaMask confirmation...");

    try {
      const txHash = await setAllowedAddressOnchain({
        allowed: true,
        target,
        walletAddress: agent.walletAddress,
      });

      if (txHash) {
        setNotice(`Allowed target transaction confirmed: ${txHash}`);
      } else {
        setNotice("Address is already allowed on-chain. Verifying state...");
      }

      const confirmedAllowed = await readAllowedAddressOnchain({
        target,
        walletAddress: agent.walletAddress,
      });

      if (confirmedAllowed !== true) {
        throw new Error(
          "The target was not confirmed as allowed on-chain after the transaction.",
        );
      }

      setNewAllowedAddress("");
      await refreshOnchainState();

      setNotice(
        txHash
          ? `Custom allowed target stored on-chain: ${txHash}`
          : "Custom address is already allowed on-chain.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not add address on-chain.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeAllowedAddress = async (target: Address) => {
    setNotice("");

    if (!agent.walletAddress) {
      setNotice("Create a smart wallet before removing allowed targets.");
      return;
    }

    if (!isOwner) {
      setNotice("Only the smart wallet owner can remove allowed targets.");
      return;
    }

    setIsSaving(true);
    setNotice("Waiting for MetaMask confirmation...");

    try {
      const txHash = await setAllowedAddressOnchain({
        allowed: false,
        target,
        walletAddress: agent.walletAddress,
      });

      await refreshOnchainState();

      setNotice(
        txHash
          ? `Allowed target removed on-chain: ${txHash}`
          : "Address is already blocked on-chain.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not remove address.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveActiveBenchmark = async () => {
    setNotice("");

    if (!activeBenchmarkId) {
      setNotice("Select a benchmark first.");
      return;
    }

    if (!isOwner) {
      setNotice("Only the owner can assign benchmarks.");
      return;
    }

    setIsSaving(true);
    setNotice("Waiting for MetaMask confirmation...");

    try {
      await selectBenchmarkForAgentOnchain({
        agentId,
        benchmarkId: activeBenchmarkId,
      });

      await refreshBenchmarks();
      setNotice("Benchmark selected for this agent on-chain.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not select benchmark.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className="summary-card autonomy-panel"
      aria-label="Agent access controls"
    >
      <div className="card-heading-row">
        <h3>Executor</h3>
        <span
          className={`status-pill ${
            executorConfigured ? "status-ready" : "status-disconnected"
          }`}
        >
          {executorConfigured ? "Set" : "Not set"}
        </span>
      </div>

      {!isAutonomyReady && (
        <p className="ownership-note">
          Agent wallet contracts are not configured for this frontend yet.
        </p>
      )}

      {isLoadingState && <CardSkeleton />}

      <div className="executor-form">
        <label>
          <span>Executor address</span>
          <input
            onChange={(event) => {
              setExecutor(event.target.value);
              setExecutorEdited(true);
            }}
            placeholder="0x..."
            value={executor}
          />
        </label>

        <button
          className="primary-action"
          disabled={
            !isOwner ||
            !isIdentityWallet ||
            !isAutonomyReady ||
            !agent.walletAddress ||
            isSaving ||
            isLoadingState
          }
          onClick={() => void savePolicy()}
          type="button"
        >
          {isSaving
            ? "Waiting..."
            : executorConfigured
              ? "Update Executor"
              : "Set Executor"}
        </button>
      </div>

      <details className="advanced-permission-settings">
        <summary>Limits</summary>

        <div className="form-grid">
          <label>
            <span>Max Action MNT</span>
            <input
              min="0"
              onChange={(event) => setMaxAction(event.target.value)}
              step="0.001"
              type="number"
              value={maxAction}
            />
          </label>

          <label>
            <span>Daily Limit MNT</span>
            <input
              min="0"
              onChange={(event) => setDailyLimit(event.target.value)}
              step="0.001"
              type="number"
              value={dailyLimit}
            />
          </label>

          <label>
            <span>Valid Hours</span>
            <input
              min="1"
              onChange={(event) => setValidForHours(Number(event.target.value))}
              type="number"
              value={validForHours}
            />
          </label>
        </div>
      </details>

      <div className="allowed-address-manager">
        <div className="card-heading-row">
          <h3>Benchmark Applied To This Wallet</h3>

          <button
            className="ghost-action"
            disabled={!isBenchmarkReady || isSaving || isLoadingBenchmarks}
            onClick={() => void refreshBenchmarks()}
            type="button"
          >
            Refresh
          </button>
        </div>

        {isLoadingBenchmarks ? (
          <CardSkeleton />
        ) : (
          <section className="summary-card">
            <h4>Current Benchmark</h4>

            {activeBenchmark ? (
              <dl>
                <div>
                  <dt>Benchmark</dt>
                  <dd>{benchmarkLabel(activeBenchmark)}</dd>
                </div>

                <div>
                  <dt>Target contract addresses</dt>
                  <dd>
                    {activeBenchmark.targetContracts.length > 0
                      ? activeBenchmark.targetContracts.map((address) => (
                          <span key={address} title={address}>
                            {address.slice(0, 8)}...{address.slice(-6)}
                          </span>
                        ))
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>No benchmark selected for this smart wallet.</p>
            )}
          </section>
        )}

        <div className="executor-form">
          <label>
            <span>Benchmark</span>
            <select
              disabled={
                !isBenchmarkReady ||
                isLoadingBenchmarks ||
                benchmarks.length === 0
              }
              onChange={(event) => setActiveBenchmarkId(event.target.value)}
              value={activeBenchmarkId}
            >
              <option value="">Select benchmark</option>
              {benchmarks.map((benchmark) => (
                <option
                  key={String(benchmark.benchmarkId)}
                  value={String(benchmark.benchmarkId)}
                >
                  {benchmarkLabel(benchmark)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="primary-action"
            disabled={
              !isOwner ||
              !isBenchmarkReady ||
              !activeBenchmarkId ||
              isSaving ||
              isLoadingBenchmarks
            }
            onClick={() => void saveActiveBenchmark()}
            type="button"
          >
            Use Benchmark
          </button>
        </div>

        {!isBenchmarkReady && (
          <p className="ownership-note">
            Benchmark registry is not deployed yet.
          </p>
        )}

        {isBenchmarkReady && !isLoadingBenchmarks && benchmarks.length === 0 && (
          <p className="ownership-note">
            Create a benchmark before assigning one to this agent.
          </p>
        )}

        <div className="card-heading-row">
          <h3>Allowed Addresses</h3>

          <button
            className="ghost-action"
            disabled={
              !isIdentityWallet || !isAutonomyReady || isSaving || isLoadingState
            }
            onClick={() => void refreshOnchainState()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="executor-form">
          <label>
            <span>Add contract address</span>
            <input
              disabled={
                !isOwner ||
                !isIdentityWallet ||
                !isAutonomyReady ||
                !agent.walletAddress ||
                isSaving ||
                isLoadingState
              }
              onChange={(event) => setNewAllowedAddress(event.target.value)}
              placeholder="0x..."
              value={newAllowedAddress}
            />
          </label>

          <button
            className="secondary-action"
            disabled={
              !isOwner ||
              !isIdentityWallet ||
              !isAutonomyReady ||
              !agent.walletAddress ||
              isSaving ||
              isLoadingState
            }
            onClick={() => void addAllowedAddress()}
            type="button"
          >
            {isSaving ? "Waiting..." : "Store On-Chain"}
          </button>
        </div>

        {!agent.walletAddress && (
          <p className="ownership-note">
            Create a smart wallet before adding allowed addresses.
          </p>
        )}

        {isLoadingState ? (
          <CardSkeleton />
        ) : (
          <div className="allowed-address-list">
            {allowedAddresses.map((row) => (
              <div className="allowed-address-row" key={row.address}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{formatAddress(row.address)}</span>
                  {row.txHash && <span>Tx {formatAddress(row.txHash)}</span>}
                </div>

                <div className="allowed-address-actions">
                  <span
                    className={`status-pill ${
                      row.allowed ? "status-ready" : "status-disconnected"
                    }`}
                  >
                    {row.allowed === undefined
                      ? "Checking"
                      : row.allowed
                        ? "Allowed"
                        : "Blocked"}
                  </span>

                  <button
                    className="ghost-action"
                    disabled={
                      !isOwner || !row.allowed || isSaving || isLoadingState
                    }
                    onClick={() => void removeAllowedAddress(row.address)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice && <p className="ownership-note">{notice}</p>}
    </section>
  );
}
