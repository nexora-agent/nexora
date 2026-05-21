"use client";

import type { AgentStrategyType, RiskMode } from "@nexora/shared";

type AgentStrategyStepProps = {
  riskMode: RiskMode;
  strategyType: AgentStrategyType;
  onRiskModeChange: (riskMode: RiskMode) => void;
  onStrategyTypeChange: (strategyType: AgentStrategyType) => void;
};

const strategies: Array<{ label: string; value: AgentStrategyType }> = [
  { label: "Defensive", value: "defensive" },
  { label: "Balanced", value: "balanced" },
  { label: "Opportunistic", value: "opportunistic" },
];

const riskModes: Array<{ label: string; value: RiskMode }> = [
  { label: "Conservative", value: "conservative" },
  { label: "Balanced", value: "balanced" },
  { label: "Experimental", value: "experimental" },
];

export function AgentStrategyStep({
  riskMode,
  strategyType,
  onRiskModeChange,
  onStrategyTypeChange,
}: AgentStrategyStepProps) {
  return (
    <div className="form-grid">
      <fieldset className="wizard-fieldset">
        <legend>Strategy Type</legend>
        <div className="segmented-control">
          {strategies.map((strategy) => (
            <label key={strategy.value}>
              <input
                checked={strategyType === strategy.value}
                name="strategy-type"
                onChange={() => onStrategyTypeChange(strategy.value)}
                type="radio"
                value={strategy.value}
              />
              <span>{strategy.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="wizard-fieldset">
        <legend>Default Risk Style</legend>
        <div className="segmented-control">
          {riskModes.map((mode) => (
            <label key={mode.value}>
              <input
                checked={riskMode === mode.value}
                name="risk-mode"
                onChange={() => onRiskModeChange(mode.value)}
                type="radio"
                value={mode.value}
              />
              <span>{mode.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
