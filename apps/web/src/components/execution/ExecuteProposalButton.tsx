"use client";

import type { AgentRecord, ObjectiveRun, PolicyProfile } from "@nexora/shared";
import { useState } from "react";
import {
  canFallbackExecution,
  executeRunOnchain,
} from "@/lib/contracts/onchainExecution";
import {
  canFallbackReputation,
  recordReputationRunOnchain,
} from "@/lib/contracts/onchainReputation";
import { gateExecution } from "@/lib/execution/gateExecution";

type ExecuteProposalButtonProps = {
  agent: AgentRecord;
  policy: PolicyProfile;
  run: ObjectiveRun;
  onExecution: (run: ObjectiveRun) => void;
};

export function ExecuteProposalButton({
  agent,
  policy,
  run,
  onExecution,
}: ExecuteProposalButtonProps) {
  const [error, setError] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const executeProposal = async () => {
    setError("");
    setIsExecuting(true);

    try {
      let execution = gateExecution(run, policy);

      if (execution.status === "executed" && agent.walletAddress) {
        try {
          const transactionHash = await executeRunOnchain(agent, run, policy);
          execution = {
            ...execution,
            reason: "Policy report verified on wallet; transaction submitted on Mantle.",
            transactionHash,
          };
        } catch (caughtError) {
          if (!canFallbackExecution(caughtError)) {
            throw caughtError;
          }
        }
      }

      if (agent.walletAddress) {
        try {
          const reputationTransactionHash = await recordReputationRunOnchain(
            run,
            execution,
          );
          execution = {
            ...execution,
            reputationTransactionHash,
          };
        } catch (caughtError) {
          if (!canFallbackReputation(caughtError)) {
            throw caughtError;
          }
        }
      }

      onExecution({
        ...run,
        execution,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not execute proposal.",
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="execution-action-panel">
      <button
        className="primary-action form-submit"
        disabled={isExecuting}
        onClick={() => void executeProposal()}
        type="button"
      >
        {isExecuting ? "Executing..." : "Execute Proposal"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
