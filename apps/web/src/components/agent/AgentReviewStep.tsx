"use client";

import type {
  AgentRuntime,
  AgentRuntimeId,
  AgentStrategyType,
  RiskMode,
} from "@nexora/shared";

type AgentReviewStepProps = {
  description: string;
  name: string;
  riskMode: RiskMode;
  runtime: AgentRuntimeId;
  runtimes: AgentRuntime[];
  strategyType: AgentStrategyType;
};

function formatValue(value: string) {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function AgentReviewStep({
  description,
  name,
  riskMode,
  runtime,
  runtimes,
  strategyType,
}: AgentReviewStepProps) {
  const runtimeLabel =
    runtimes.find((option) => option.id === runtime)?.label ?? runtime;

  return (
    <section className="wizard-review" aria-label="Smart wallet review">
      <dl>
        <div>
          <dt>Smart Wallet Name</dt>
          <dd>{name || "Not set"}</dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{description || "Not set"}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{runtimeLabel}</dd>
        </div>
        <div>
          <dt>Strategy Type</dt>
          <dd>{formatValue(strategyType)}</dd>
        </div>
        <div>
          <dt>Default Risk Style</dt>
          <dd>{formatValue(riskMode)}</dd>
        </div>
        <div>
          <dt>Objective</dt>
          <dd>No objective yet</dd>
        </div>
      </dl>
    </section>
  );
}
