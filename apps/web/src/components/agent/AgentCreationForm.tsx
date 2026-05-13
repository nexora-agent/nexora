"use client";

import type { RiskMode } from "@nexora/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { createLocalAgent } from "@/lib/agents/localAgentRegistry";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { NetworkSwitcher } from "../wallet/NetworkSwitcher";

const riskModes: Array<{ label: string; value: RiskMode }> = [
  { label: "Conservative", value: "conservative" },
  { label: "Balanced", value: "balanced" },
  { label: "Experimental", value: "experimental" },
];

export function AgentCreationForm() {
  const router = useRouter();
  const { address, isReady, readiness } = useWalletConnection();
  const [name, setName] = useState("YieldGuard-01");
  const [goal, setGoal] = useState("Safe DeFi activity on Mantle");
  const [riskMode, setRiskMode] = useState<RiskMode>("conservative");
  const [error, setError] = useState("");

  const canSubmit = Boolean(address && isReady);

  const createAgent = () => {
    setError("");

    if (!name.trim()) {
      setError("Agent name is required.");
      return;
    }

    if (!goal.trim()) {
      setError("Agent goal is required.");
      return;
    }

    if (!address || !isReady) {
      setError("Connect your owner wallet on Mantle before creating an agent.");
      return;
    }

    const agent = createLocalAgent({
      name: name.trim(),
      goal: goal.trim(),
      riskMode,
      ownerAddress: address,
    });

    router.push(`/agents/${agent.id}`);
  };

  return (
    <section className="agent-form-card" aria-label="Create agent form">
      <div className="form-grid">
        <label>
          <span>Agent Name</span>
          <input
            aria-label="Agent Name"
            onChange={(event) => setName(event.target.value)}
            placeholder="YieldGuard-01"
            type="text"
            value={name}
          />
        </label>

        <label>
          <span>Goal</span>
          <textarea
            aria-label="Goal"
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Safe DeFi activity on Mantle"
            rows={4}
            value={goal}
          />
        </label>

        <fieldset>
          <legend>Risk Mode</legend>
          <div className="segmented-control">
            {riskModes.map((mode) => (
              <label key={mode.value}>
                <input
                  checked={riskMode === mode.value}
                  name="risk-mode"
                  onChange={() => setRiskMode(mode.value)}
                  type="radio"
                  value={mode.value}
                />
                <span>{mode.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {readiness === "disconnected" && (
        <div className="form-wallet-callout">
          <p>Connect the owner wallet before creating the agent identity.</p>
          <ConnectWalletButton />
        </div>
      )}

      <NetworkSwitcher />

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <button
        className="primary-action form-submit"
        disabled={!canSubmit}
        onClick={createAgent}
        type="button"
      >
        Create Agent
      </button>
    </section>
  );
}
