"use client";

import type { ObjectiveRun } from "@nexora/shared";
import { useState } from "react";
import { executeByrealLiveRemote } from "@/lib/byreal/byrealClient";

type ByrealLiveExecutionButtonProps = {
  run: ObjectiveRun;
  onExecution?: (run: ObjectiveRun) => void;
};

const consentPhrase = "EXECUTE BYREAL LIVE";

export function ByrealLiveExecutionButton({
  onExecution,
  run,
}: ByrealLiveExecutionButtonProps) {
  const [status, setStatus] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const intent = run.intent;
  const actionKind =
    intent?.kind === "byreal_swap_preview" || intent?.kind === "byreal_lp_deposit_preview"
      ? intent.kind
      : undefined;
  const canExecute =
    intent &&
    actionKind &&
    intent.metadata?.liveExecutionEnabled;

  const execute = async () => {
    if (!intent || !canExecute) {
      setStatus("Live Byreal execution is not enabled for this proposal.");
      return;
    }

    const operatorConsent = window.prompt(
      `Type ${consentPhrase} to execute this Byreal action with the local CLI wallet.`,
    );

    if (operatorConsent !== consentPhrase) {
      setStatus("Execution cancelled.");
      return;
    }

    setIsExecuting(true);
    setStatus("");

    try {
      const result = await executeByrealLiveRemote({
        actionKind,
        amount: intent.amount,
        intentHash: intent.intentHash,
        operatorConsent,
        poolId: intent.metadata?.poolId,
        poolName: intent.metadata?.poolName,
      });
      const updatedRun: ObjectiveRun = {
        ...run,
        execution: {
          createdAt: new Date().toISOString(),
          id: `byreal-execution-${run.id}`,
          intentHash: intent.intentHash,
          objectiveRunId: run.id,
          reason: result.success
            ? `Byreal live execution submitted locally. ${result.rawOutput ?? ""}`.trim()
            : result.blockedReason ?? "Byreal live execution was blocked.",
          status: result.success ? "executed" : "blocked",
        },
      };

      setStatus(updatedRun.execution?.reason ?? "");
      onExecution?.(updatedRun);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Byreal live execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <section className="summary-card" aria-label="Byreal live execution">
      <h3>Byreal Live Execution</h3>
      <p>
        {canExecute
          ? "Local CLI execution is enabled for this bounded action."
          : "Live execution is disabled unless the local Byreal CLI wallet and environment flags are configured."}
      </p>
      <button
        className="primary-action"
        disabled={!canExecute || isExecuting}
        onClick={execute}
        type="button"
      >
        {isExecuting ? "Executing..." : "Execute With Local Byreal CLI"}
      </button>
      {status && <span>{status}</span>}
    </section>
  );
}
