"use client";

import type { AgentRecord } from "@nexora/shared";
import { useWalletBalance } from "@/hooks/useWalletBalance";

type LifecycleState = "complete" | "current" | "blocked" | "missing";

type LifecycleStep = {
  label: string;
  state: LifecycleState;
};

type AgentLifecycleProgressProps = {
  agent: AgentRecord;
};

function stepClass(state: LifecycleState) {
  return `lifecycle-step lifecycle-${state}`;
}

export function getLifecycleSteps(
  agent: AgentRecord,
  funded = false,
): LifecycleStep[] {
  const hasWallet = Boolean(agent.walletAddress);
  const hasRun = Boolean(agent.objectiveRuns?.length);
  const latestScore = agent.objectiveRuns?.[0]?.benchmarkScore?.finalScore ?? 0;

  return [
    { label: "Smart wallet profile created", state: "complete" },
    {
      label: "Harness selected",
      state: agent.selectedHarnessId ? "complete" : "current",
    },
    {
      label: "Runner configured",
      state: agent.runnerMode ? "complete" : "missing",
    },
    {
      label: "Smart wallet deployed",
      state: hasWallet ? "complete" : "current",
    },
    {
      label: "Wallet funded",
      state: !hasWallet ? "blocked" : funded ? "complete" : "current",
    },
    {
      label: "Benchmark run",
      state: hasRun ? "complete" : hasWallet ? "current" : "blocked",
    },
    {
      label: "Eligible for Live Mode",
      state: latestScore >= 70 && funded ? "complete" : "blocked",
    },
  ];
}

export function AgentLifecycleProgress({ agent }: AgentLifecycleProgressProps) {
  const { isLoading, isZeroBalance } = useWalletBalance(agent.walletAddress);
  const steps = getLifecycleSteps(agent, Boolean(agent.walletAddress && !isZeroBalance));

  return (
    <section className="lifecycle-card" aria-label="Smart wallet lifecycle">
      <div className="console-topline">
        <span>Lifecycle</span>
        <span className="status-pill status-ready">
          {steps.filter((step) => step.state === "complete").length} / {steps.length}
        </span>
      </div>
      <ol>
        {steps.map((step) => (
          <li className={stepClass(step.state)} key={step.label}>
            <strong>{step.label}</strong>
            <span>
              {step.label === "Wallet funded" && isLoading
                ? "checking"
                : step.state}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
