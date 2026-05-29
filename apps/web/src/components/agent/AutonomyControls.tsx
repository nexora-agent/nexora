"use client";

import type { AgentRecord } from "@nexora/shared";
import { useState } from "react";
import { isV2DeploymentReady } from "@/lib/contracts/deployments";
import {
  allowBenchmarkVaultsOnchain,
  saveExecutorPolicyOnchain,
} from "@/lib/contracts/onchainAutonomy";

type AutonomyControlsProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onSaved: (agent: AgentRecord) => void;
};

export function AutonomyControls({ agent, isOwner, onSaved }: AutonomyControlsProps) {
  const [dailyLimit, setDailyLimit] = useState(agent.autonomy?.dailyLimit ?? "0.05");
  const [executor, setExecutor] = useState(agent.autonomy?.executorAddress ?? "");
  const [maxAction, setMaxAction] = useState(agent.autonomy?.maxValuePerAction ?? "0.01");
  const [notice, setNotice] = useState("");
  const [validForHours, setValidForHours] = useState(24);
  const [isSaving, setIsSaving] = useState(false);
  const isV2 = agent.identityStandard === "erc-8004";
  const isV2Ready = isV2DeploymentReady();

  const savePolicy = async () => {
    setNotice("");

    if (!executor.match(/^0x[a-fA-F0-9]{40}$/)) {
      setNotice("Enter a valid executor address.");
      return;
    }

    setIsSaving(true);
    try {
      await saveExecutorPolicyOnchain({
        dailyLimitMnt: dailyLimit,
        enabled: true,
        executor: executor as `0x${string}`,
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
          executorAddress: executor as `0x${string}`,
          maxValuePerAction: maxAction,
          validUntil: new Date(Date.now() + validForHours * 60 * 60 * 1000).toISOString(),
        },
      });
      setNotice("Executor policy saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save executor policy.");
    } finally {
      setIsSaving(false);
    }
  };

  const allowTargets = async () => {
    setNotice("");
    setIsSaving(true);
    try {
      await allowBenchmarkVaultsOnchain(agent.walletAddress);
      setNotice("Benchmark vaults allowed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not allow benchmark vaults.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="summary-card" aria-label="Autonomy controls">
      <div className="card-heading-row">
        <h3>Local Autonomy</h3>
        <span
          className={`status-pill ${
            isV2 && isV2Ready ? "status-ready" : "status-disconnected"
          }`}
        >
          {isV2 ? (isV2Ready ? "V2" : "V2 pending") : "Legacy"}
        </span>
      </div>
      {!isV2Ready && (
        <p className="ownership-note">
          V2 autonomy is not available in this frontend config yet. Deploy the V2
          contracts and update the configured addresses first.
        </p>
      )}
      <dl>
        <div>
          <dt>Agent ID</dt>
          <dd>{agent.agentIdentityId ?? agent.id}</dd>
        </div>
        <div>
          <dt>Runner</dt>
          <dd>pnpm agent:runner</dd>
        </div>
      </dl>
      <div className="form-grid">
        <label>
          <span>Executor Address</span>
          <input
            onChange={(event) => setExecutor(event.target.value)}
            placeholder="0x..."
            value={executor}
          />
        </label>
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
      <div className="table-action-group">
        <button
          className="primary-action"
          disabled={!isOwner || !isV2 || !isV2Ready || isSaving}
          onClick={() => void savePolicy()}
          type="button"
        >
          {isSaving ? "Saving..." : "Enable Local Autonomy"}
        </button>
        <button
          className="secondary-action"
          disabled={!isOwner || !isV2 || !isV2Ready || isSaving}
          onClick={() => void allowTargets()}
          type="button"
        >
          Allow Benchmark Vaults
        </button>
      </div>
      {notice && <p className="ownership-note">{notice}</p>}
    </section>
  );
}
