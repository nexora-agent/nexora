"use client";

import type { AgentRecord } from "@nexora/shared";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { isAgentWalletDeploymentReady } from "@/lib/contracts/deployments";
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
  allowed: boolean;
  label: string;
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function formatAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function AutonomyControls({ agent, isOwner, onSaved }: AutonomyControlsProps) {
  const [dailyLimit, setDailyLimit] = useState(agent.autonomy?.dailyLimit ?? "0.05");
  const [executor, setExecutor] = useState(agent.autonomy?.executorAddress ?? "");
  const [maxAction, setMaxAction] = useState(agent.autonomy?.maxValuePerAction ?? "0.01");
  const [validForHours, setValidForHours] = useState(24);
  const [newAllowedAddress, setNewAllowedAddress] = useState("");
  const [customAddresses, setCustomAddresses] = useState<AllowedAddressRow[]>([]);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [onchainState, setOnchainState] = useState<AutonomyOnchainState | undefined>();
  const [executorEdited, setExecutorEdited] = useState(false);
  const isIdentityWallet = agent.identityStandard === "erc-8004";
  const isAutonomyReady = isAgentWalletDeploymentReady();
  const agentId = agent.agentIdentityId ?? agent.id;
  const executorConfigured =
    Boolean(onchainState?.enabled) &&
    Boolean(onchainState?.reporterAuthorized) &&
    onchainState?.executor.toLowerCase() !== zeroAddress;
  const allowedAddresses = useMemo<AllowedAddressRow[]>(() => {
    const defaults =
      onchainState?.benchmarkVaults.map((vault) => ({
        address: vault.address,
        allowed: vault.targetAllowed,
        label: vault.label,
      })) ?? [];
    const seen = new Set(defaults.map((row) => row.address.toLowerCase()));
    return [
      ...defaults,
      ...customAddresses.filter((row) => !seen.has(row.address.toLowerCase())),
    ];
  }, [customAddresses, onchainState]);

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

      if (customAddresses.length > 0) {
        const refreshed = await Promise.all(
          customAddresses.map(async (row) => ({
            ...row,
            allowed: await readAllowedAddressOnchain({
              target: row.address,
              walletAddress: agent.walletAddress,
            }),
          })),
        );
        setCustomAddresses(refreshed);
      }
    } catch {
      setNotice("Could not read executor settings from this smart wallet.");
    } finally {
      setIsLoadingState(false);
    }
  };

  useEffect(() => {
    void refreshOnchainState();
  }, [agent.walletAddress, agentId, isAutonomyReady, isIdentityWallet]);

  const savePolicy = async () => {
    setNotice("");

    if (!isAddress(executor)) {
      setNotice("Enter a valid executor address.");
      return;
    }

    setIsSaving(true);
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
          validUntil: new Date(Date.now() + validForHours * 60 * 60 * 1000).toISOString(),
        },
      });
      await refreshOnchainState();
      setNotice("Executor address saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save executor address.");
    } finally {
      setIsSaving(false);
    }
  };

  const addAllowedAddress = async () => {
    setNotice("");

    if (!isAddress(newAllowedAddress)) {
      setNotice("Enter a valid contract address.");
      return;
    }

    setIsSaving(true);
    try {
      await setAllowedAddressOnchain({
        allowed: true,
        target: newAllowedAddress,
        walletAddress: agent.walletAddress,
      });
      const row = {
        address: newAllowedAddress,
        allowed: true,
        label: "Custom address",
      };
      setCustomAddresses((rows) => [
        row,
        ...rows.filter((existing) => existing.address.toLowerCase() !== row.address.toLowerCase()),
      ]);
      setNewAllowedAddress("");
      await refreshOnchainState();
      setNotice("Address added.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add address.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeAllowedAddress = async (target: Address) => {
    setNotice("");
    setIsSaving(true);
    try {
      await setAllowedAddressOnchain({
        allowed: false,
        target,
        walletAddress: agent.walletAddress,
      });
      setCustomAddresses((rows) =>
        rows.map((row) => (row.address.toLowerCase() === target.toLowerCase() ? { ...row, allowed: false } : row)),
      );
      await refreshOnchainState();
      setNotice("Address removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove address.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="summary-card autonomy-panel" aria-label="Agent access controls">
      <div className="card-heading-row">
        <h3>Executor</h3>
        <span className={`status-pill ${executorConfigured ? "status-ready" : "status-disconnected"}`}>
          {executorConfigured ? "Set" : "Not set"}
        </span>
      </div>

      {!isAutonomyReady && (
        <p className="ownership-note">
          Agent wallet contracts are not configured for this frontend yet.
        </p>
      )}

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
          disabled={!isOwner || !isIdentityWallet || !isAutonomyReady || isSaving || isLoadingState}
          onClick={() => void savePolicy()}
          type="button"
        >
          {isSaving ? "Saving..." : executorConfigured ? "Update Executor" : "Set Executor"}
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
          <h3>Allowed Addresses</h3>
          <button
            className="ghost-action"
            disabled={!isIdentityWallet || !isAutonomyReady || isSaving || isLoadingState}
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
              onChange={(event) => setNewAllowedAddress(event.target.value)}
              placeholder="0x..."
              value={newAllowedAddress}
            />
          </label>
          <button
            className="secondary-action"
            disabled={!isOwner || !isIdentityWallet || !isAutonomyReady || isSaving || isLoadingState}
            onClick={() => void addAllowedAddress()}
            type="button"
          >
            Add Address
          </button>
        </div>

        <div className="allowed-address-list">
          {allowedAddresses.map((row) => (
            <div className="allowed-address-row" key={row.address}>
              <div>
                <strong>{row.label}</strong>
                <span>{formatAddress(row.address)}</span>
              </div>
              <div className="allowed-address-actions">
                <span className={`status-pill ${row.allowed ? "status-ready" : "status-disconnected"}`}>
                  {row.allowed ? "Allowed" : "Blocked"}
                </span>
                <button
                  className="ghost-action"
                  disabled={!isOwner || !row.allowed || isSaving || isLoadingState}
                  onClick={() => void removeAllowedAddress(row.address)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {notice && <p className="ownership-note">{notice}</p>}
    </section>
  );
}
