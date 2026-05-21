"use client";

import type { AgentRecord, HarnessId, HarnessTemplate } from "@nexora/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { saveLocalAgentHarness } from "@/lib/agents/localAgentRegistry";
import {
  getAllHarnessTemplates,
  getHarnessTemplate,
  harnessTemplates,
} from "@/lib/harness/harnessTemplates";
import { HarnessDetailPanel } from "./HarnessDetailPanel";
import { HarnessTemplateCard } from "./HarnessTemplateCard";

type HarnessSelectorProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onHarnessSaved: (agent: AgentRecord) => void;
};

export function HarnessSelector({
  agent,
  isOwner,
  onHarnessSaved,
}: HarnessSelectorProps) {
  const { address } = useWalletConnection();
  const [selectedHarnessId, setSelectedHarnessId] = useState<HarnessId>(
    agent.selectedHarnessId ?? "safe-approval",
  );
  const [availableHarnesses, setAvailableHarnesses] =
    useState<HarnessTemplate[]>(harnessTemplates);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedHarness =
    availableHarnesses.find((harness) => harness.id === selectedHarnessId) ??
    getHarnessTemplate(selectedHarnessId);

  useEffect(() => {
    setAvailableHarnesses(getAllHarnessTemplates());
  }, []);

  const saveHarness = () => {
    setError("");
    setNotice("");

    if (!address) {
      setError("Connect the owner wallet before saving a harness.");
      return;
    }

    try {
      const updatedAgent = saveLocalAgentHarness(
        agent.id,
        address,
        selectedHarnessId,
      );
      onHarnessSaved(updatedAgent);
      setNotice("Harness saved for this smart wallet.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save harness.",
      );
    }
  };

  return (
    <section className="harness-selector-card" aria-label="Harness selector">
      <div className="console-topline">
        <span>Harness</span>
        <span className="status-pill status-ready">Selected</span>
      </div>

      <div className="harness-card-grid">
        {availableHarnesses.map((harness) => (
          <HarnessTemplateCard
            harness={harness}
            isSelected={selectedHarnessId === harness.id}
            key={harness.id}
            onSelect={setSelectedHarnessId}
          />
        ))}
      </div>

      <HarnessDetailPanel harness={selectedHarness} />

      {isOwner ? (
        <div className="harness-action-row">
          <button
            className="primary-action"
            onClick={saveHarness}
            type="button"
          >
            Save Harness
          </button>
          <Link className="secondary-action" href="/harnesses/new">
            Create Harness
          </Link>
        </div>
      ) : (
        <p className="ownership-note">
          Only the owner wallet can change this smart wallet harness.
        </p>
      )}

      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
