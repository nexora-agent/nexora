"use client";

import type { AgentRuntime, AgentRuntimeId } from "@nexora/shared";

type AgentRuntimeStepProps = {
  runtime: AgentRuntimeId;
  runtimes: AgentRuntime[];
  onRuntimeChange: (runtime: AgentRuntimeId) => void;
};

export function AgentRuntimeStep({
  runtime,
  runtimes,
  onRuntimeChange,
}: AgentRuntimeStepProps) {
  return (
    <fieldset className="wizard-fieldset">
      <legend>Runtime / Model</legend>
      <div className="choice-grid">
        {runtimes.map((option) => (
          <label className="choice-card" key={option.id}>
            <input
              checked={runtime === option.id}
              name="agent-runtime"
              onChange={() => onRuntimeChange(option.id)}
              type="radio"
              value={option.id}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.model}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
