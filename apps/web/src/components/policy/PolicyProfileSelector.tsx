"use client";

import type { PolicyProfile } from "@nexora/shared";
import { balancedPolicy, defaultPolicy } from "@/lib/agents/localAgentRegistry";

type PolicyProfileSelectorProps = {
  onSelect: (policy: PolicyProfile) => void;
};

export function PolicyProfileSelector({ onSelect }: PolicyProfileSelectorProps) {
  return (
    <div className="policy-template-row" aria-label="Policy templates">
      <button
        className="secondary-action"
        onClick={() => onSelect(defaultPolicy)}
        type="button"
      >
        Conservative
      </button>
      <button
        className="secondary-action"
        onClick={() => onSelect(balancedPolicy)}
        type="button"
      >
        Balanced
      </button>
    </div>
  );
}
