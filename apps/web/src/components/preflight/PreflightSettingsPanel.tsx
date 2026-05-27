"use client";

import type { AgentRecord, PreflightPresetId, PreflightThresholds } from "@nexora/shared";
import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { savePreflightThresholdsOnchain } from "@/lib/contracts/onchainPreflight";
import {
  getPreflightThresholds,
  preflightPresetLabel,
  preflightPresets,
} from "@/lib/preflight/preflightPolicy";

type PreflightSettingsPanelProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onSaved: (agent: AgentRecord) => void;
};

const presetIds: PreflightPresetId[] = ["conservative", "balanced", "aggressive", "custom"];

function clampNumber(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function transactionNotice(error: unknown) {
  if (!(error instanceof Error)) {
    return "Could not save preflight settings.";
  }

  if (
    error.message.includes("Transaction was cancelled") ||
    error.message.includes("User denied") ||
    error.message.includes("user rejected") ||
    error.message.includes("4001")
  ) {
    return "Transaction was cancelled in MetaMask.";
  }

  return error.message;
}

export function PreflightSettingsPanel({
  agent,
  isOwner,
  onSaved,
}: PreflightSettingsPanelProps) {
  const { address } = useWalletConnection();
  const [thresholds, setThresholds] = useState<PreflightThresholds>(() =>
    getPreflightThresholds(agent),
  );
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateThreshold = <Key extends keyof PreflightThresholds>(
    key: Key,
    value: PreflightThresholds[Key],
  ) => {
    setThresholds((current) => ({
      ...current,
      preset: key === "preset" ? (value as PreflightPresetId) : "custom",
      [key]: value,
    }));
  };

  const selectPreset = (preset: PreflightPresetId) => {
    if (preset === "custom") {
      setThresholds((current) => ({ ...current, preset: "custom" }));
      return;
    }

    setThresholds(preflightPresets[preset]);
  };

  const save = async () => {
    setNotice("");

    if (!address) {
      setNotice("Connect the owner wallet first.");
      return;
    }

    try {
      setIsSaving(true);
      setNotice("Confirm the settings transaction in MetaMask.");
      await savePreflightThresholdsOnchain(agent.id, thresholds, {
        useV2Validation: agent.identityStandard === "erc-8004",
      });
      onSaved({
        ...agent,
        metadata: {
          ...agent.metadata,
          preflightThresholds: thresholds,
        },
        preflightThresholds: thresholds,
      });
      setNotice("Preflight settings saved on Mantle.");
    } catch (caughtError) {
      setNotice(transactionNotice(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="policy-editor-card" aria-label="Preflight settings">
      <div className="console-topline">
        <span>Preflight Settings</span>
        <span className="status-pill status-current">
          {preflightPresetLabel(thresholds.preset)}
        </span>
      </div>

      <div className="policy-template-row" aria-label="Preflight presets">
        {presetIds.map((preset) => (
          <button
            aria-pressed={thresholds.preset === preset}
            className={thresholds.preset === preset ? "secondary-action active" : "secondary-action"}
            disabled={!isOwner || isSaving}
            key={preset}
            onClick={() => selectPreset(preset)}
            type="button"
          >
            {preflightPresetLabel(preset)}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label>
          Basic Safety minimum
          <input
            disabled={!isOwner || isSaving}
            max={100}
            min={0}
            onChange={(event) =>
              updateThreshold(
                "basicSafetyMinScore",
                clampNumber(Number(event.target.value), 0, 100),
              )
            }
            type="number"
            value={thresholds.basicSafetyMinScore}
          />
        </label>
        <label>
          Adversarial Yield Trap minimum
          <input
            disabled={!isOwner || isSaving}
            max={100}
            min={0}
            onChange={(event) =>
              updateThreshold(
                "adversarialYieldTrapMinScore",
                clampNumber(Number(event.target.value), 0, 100),
              )
            }
            type="number"
            value={thresholds.adversarialYieldTrapMinScore}
          />
        </label>
        <label>
          External DeFi Readiness minimum
          <input
            disabled={!isOwner || isSaving}
            max={100}
            min={0}
            onChange={(event) =>
              updateThreshold(
                "externalDefiReadinessMinScore",
                clampNumber(Number(event.target.value), 0, 100),
              )
            }
            type="number"
            value={thresholds.externalDefiReadinessMinScore}
          />
        </label>
        <label>
          Suite average minimum
          <input
            disabled={!isOwner || isSaving}
            max={100}
            min={0}
            onChange={(event) =>
              updateThreshold(
                "averageMinScore",
                clampNumber(Number(event.target.value), 0, 100),
              )
            }
            type="number"
            value={thresholds.averageMinScore}
          />
        </label>
        <label>
          Preflight risk ceiling
          <input
            disabled={!isOwner || isSaving}
            max={100}
            min={0}
            onChange={(event) =>
              updateThreshold("maxRiskScore", clampNumber(Number(event.target.value), 0, 100))
            }
            type="number"
            value={thresholds.maxRiskScore}
          />
        </label>
        <label>
          Freshness window minutes
          <input
            disabled={!isOwner || isSaving}
            max={1440}
            min={1}
            onChange={(event) =>
              updateThreshold(
                "freshnessMinutes",
                clampNumber(Number(event.target.value), 1, 1440),
              )
            }
            type="number"
            value={thresholds.freshnessMinutes}
          />
        </label>
      </div>

      <button
        className="primary-action form-submit"
        disabled={!isOwner || isSaving}
        onClick={() => void save()}
        type="button"
      >
        {isSaving ? "Saving..." : "Save Preflight Settings"}
      </button>
      {notice && <p className="ownership-note">{notice}</p>}
    </section>
  );
}
