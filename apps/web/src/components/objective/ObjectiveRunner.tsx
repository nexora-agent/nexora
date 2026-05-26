"use client";

import type { AgentRecord, ObjectiveRun } from "@nexora/shared";
import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { getAgentPolicy } from "@/lib/agents/localAgentRegistry";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { runObjectiveLocally } from "@/lib/objectives/runObjectiveLocally";
import { ObjectiveHistory } from "./ObjectiveHistory";
import { ObjectiveInput } from "./ObjectiveInput";
import { ObjectiveResultCard } from "./ObjectiveResultCard";
import { ObjectiveRunButton } from "./ObjectiveRunButton";

type ObjectiveRunnerProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onObjectiveRunSaved: (agent: AgentRecord) => void;
};

function agentWithRun(agent: AgentRecord, run: ObjectiveRun): AgentRecord {
  const existingRuns = agent.objectiveRuns ?? [];
  const hasRun = existingRuns.some((candidate) => candidate.id === run.id);

  return {
    ...agent,
    objectiveRuns: hasRun
      ? existingRuns.map((candidate) => candidate.id === run.id ? run : candidate)
      : [run, ...existingRuns],
  };
}

export function ObjectiveRunner({
  agent,
  isOwner,
  onObjectiveRunSaved,
}: ObjectiveRunnerProps) {
  const { address } = useWalletConnection();
  const [objective, setObjective] = useState(
    "Safe MNT Yield Test: choose the safest way to use 0.01 MNT.",
  );
  const [latestRun, setLatestRun] = useState<ObjectiveRun | undefined>(
    agent.objectiveRuns?.[0],
  );
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const policy = getAgentPolicy(agent);

  const runObjective = () => {
    setError("");

    if (!agent.walletAddress) {
      setError("Create and fund the smart wallet before running objectives.");
      return;
    }

    if (!address || !isOwner) {
      setError("Only the owner wallet can run objectives for this smart wallet.");
      return;
    }

    if (!objective.trim()) {
      setError("Objective is required.");
      return;
    }

    setIsRunning(true);

    try {
      const run = runObjectiveLocally(agent, objective.trim());
      const updatedAgent = agentWithRun(agent, run);
      setLatestRun(run);
      onObjectiveRunSaved(updatedAgent);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not run objective.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const updateObjectiveRun = (run: ObjectiveRun) => {
    const updatedAgent = agentWithRun(agent, run);
    setLatestRun(run);
    onObjectiveRunSaved(updatedAgent);
  };

  return (
    <section className="objective-runner-card" aria-label="Objective runner">
      <div className="console-topline">
        <span>Objective Runner</span>
        <span className="status-pill status-ready">{harness.name}</span>
      </div>

      <ObjectiveInput objective={objective} onObjectiveChange={setObjective} />
      <ObjectiveRunButton
        disabled={!isOwner}
        isRunning={isRunning}
        onRun={runObjective}
      />

      {!isOwner && (
        <p className="ownership-note">
          Only the owner wallet can run objectives for this smart wallet.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {latestRun && (
        <ObjectiveResultCard
          agent={agent}
          policy={policy}
          run={latestRun}
          onRunUpdated={updateObjectiveRun}
        />
      )}
      <ObjectiveHistory runs={agent.objectiveRuns ?? []} />
    </section>
  );
}
