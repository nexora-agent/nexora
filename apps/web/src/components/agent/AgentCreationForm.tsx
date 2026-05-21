"use client";

import type { RiskMode } from "@nexora/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState("YieldGuard-01");
  const [goal, setGoal] = useState("Treasury risk monitor");
  const [riskMode, setRiskMode] = useState<RiskMode>("conservative");
  const [error, setError] = useState("");

  const displayReadiness = isMounted ? readiness : "disconnected";
  const canSubmit = Boolean(isMounted && address && isReady);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const createAgent = () => {
    setError("");

    if (!name.trim()) {
      setError("Smart wallet name is required.");
      return;
    }

    if (!goal.trim()) {
      setError("Smart wallet goal is required.");
      return;
    }

    if (!address || !isReady) {
      setError("Connect your owner wallet on Mantle before creating a smart wallet.");
      return;
    }

    const agent = createLocalAgent({
      name: name.trim(),
      description: goal.trim(),
      runtime: "nexora-local",
      strategyType: "defensive",
      riskMode,
      ownerAddress: address,
    });

    router.push(`/wallets/${agent.id}`);
  };

  return (
    <section className="agent-form-card" aria-label="Create smart wallet form">
      <div className="form-grid">
        <label>
          <span>Smart Wallet Name</span>
          <input
            aria-label="Smart Wallet Name"
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
            placeholder="Treasury risk monitor"
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

      {displayReadiness === "disconnected" && (
        <div className="form-wallet-callout">
          <ConnectWalletButton />
        </div>
      )}

      {isMounted && <NetworkSwitcher />}

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
        Create Smart Wallet
      </button>
    </section>
  );
}
