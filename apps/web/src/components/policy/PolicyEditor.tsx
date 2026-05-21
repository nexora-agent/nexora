"use client";

import type { AgentRecord, PolicyProfile } from "@nexora/shared";
import { useState } from "react";
import {
  getAgentPolicy,
  saveLocalAgentPolicy,
} from "@/lib/agents/localAgentRegistry";
import { PolicyProfileSelector } from "./PolicyProfileSelector";
import { PolicySummaryCard } from "./PolicySummaryCard";

type PolicyEditorProps = {
  agent: AgentRecord;
  isOwner: boolean;
  ownerAddress?: `0x${string}`;
  onPolicySaved: (agent: AgentRecord) => void;
};

export function PolicyEditor({
  agent,
  isOwner,
  ownerAddress,
  onPolicySaved,
}: PolicyEditorProps) {
  const [policy, setPolicy] = useState<PolicyProfile>(() =>
    getAgentPolicy(agent),
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updatePolicy = <Key extends keyof PolicyProfile>(
    key: Key,
    value: PolicyProfile[Key],
  ) => {
    setPolicy((currentPolicy) => ({
      ...currentPolicy,
      [key]: value,
    }));
  };

  const savePolicy = () => {
    setError("");
    setNotice("");

    if (!ownerAddress || !isOwner) {
      setError("Only the owner wallet can update this policy.");
      return;
    }

    try {
      const updatedAgent = saveLocalAgentPolicy(agent.id, ownerAddress, policy);
      onPolicySaved(updatedAgent);
      setNotice("Policy stored on-chain-ready profile.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save policy.",
      );
    }
  };

  return (
    <section className="policy-editor-card" aria-label="Policy editor">
      <div className="console-topline">
        <span>Policy</span>
        <span className="status-pill status-ready">Active</span>
      </div>

      <PolicySummaryCard policy={policy} />

      {isOwner ? (
        <div className="policy-editor-fields">
          <PolicyProfileSelector onSelect={setPolicy} />

          <label>
            <span>Max risk score</span>
            <input
              aria-label="Max risk score"
              max={100}
              min={0}
              onChange={(event) =>
                updatePolicy("maxRiskScore", Number(event.target.value))
              }
              type="number"
              value={policy.maxRiskScore}
            />
          </label>

          <label>
            <span>Max transaction size</span>
            <input
              aria-label="Max transaction size"
              min={0}
              onChange={(event) =>
                updatePolicy(
                  "maxTransactionSizeUsd",
                  Number(event.target.value),
                )
              }
              type="number"
              value={policy.maxTransactionSizeUsd}
            />
          </label>

          <label className="checkbox-row">
            <input
              checked={policy.blockUnlimitedApprovals}
              onChange={(event) =>
                updatePolicy("blockUnlimitedApprovals", event.target.checked)
              }
              type="checkbox"
            />
            <span>Block unlimited approvals</span>
          </label>

          <label className="checkbox-row">
            <input
              checked={policy.blockUnverifiedContracts}
              onChange={(event) =>
                updatePolicy("blockUnverifiedContracts", event.target.checked)
              }
              type="checkbox"
            />
            <span>Block unverified contracts</span>
          </label>

          <label className="checkbox-row">
            <input
              checked={policy.requireRiskReport}
              onChange={(event) =>
                updatePolicy("requireRiskReport", event.target.checked)
              }
              type="checkbox"
            />
            <span>Require risk report</span>
          </label>

          <button className="primary-action form-submit" onClick={savePolicy} type="button">
            Save Policy
          </button>
        </div>
      ) : (
        <p className="ownership-note">
          Only the owner wallet can update this policy.
        </p>
      )}

      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
