"use client";

import type {
  AgentRecord,
  RiskReport,
  ToolTraceEntry,
  TransactionIntent,
} from "@nexora/shared";
import { createTransactionIntent } from "@nexora/shared";
import { useState } from "react";
import { mantleSepolia } from "@/lib/chains/mantle";
import { getAgentPolicy } from "@/lib/agents/localAgentRegistry";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { analyzeRiskLocally } from "@/lib/risk/analyzeRisk";
import { ToolTracePanel } from "../proposal/ToolTracePanel";
import { RiskReportPanel } from "../risk/RiskReportPanel";
import { TaskInputBox } from "./TaskInputBox";
import { TransactionIntentCard } from "./TransactionIntentCard";

type IntentBuilderProps = {
  agent: AgentRecord;
  isOwner: boolean;
};

const defaultTokenAddress = "0x0000000000000000000000000000000000000002";
const defaultRecipient = "0x0000000000000000000000000000000000000003";

function toolTraceForRun(
  agent: AgentRecord,
  intent: TransactionIntent,
  report: RiskReport,
): ToolTraceEntry[] {
  const harness = getHarnessTemplate(agent.selectedHarnessId);

  return [
    {
      index: 1,
      status: "success",
      summary: `Loaded smart wallet ${agent.name}.`,
      toolName: "get_agent_profile",
    },
    {
      index: 2,
      status: "success",
      summary: `Loaded ${harness.name}.`,
      toolName: "get_harness_config",
    },
    {
      index: 3,
      status: "success",
      summary: agent.walletAddress
        ? `Read balance for ${agent.walletAddress}.`
        : "No wallet address was available.",
      toolName: "get_wallet_balance",
    },
    {
      index: 4,
      status: "success",
      summary: intent.summary,
      toolName:
        intent.kind === "erc20_approval"
          ? "create_approval_intent"
          : "create_transfer_intent",
    },
    {
      index: 5,
      status: "success",
      summary: `Risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
      toolName: "analyze_risk",
    },
  ];
}

export function IntentBuilder({ agent, isOwner }: IntentBuilderProps) {
  const [task, setTask] = useState(`Send 10 USDC to ${defaultRecipient}`);
  const [tokenAddress, setTokenAddress] = useState(defaultTokenAddress);
  const [intent, setIntent] = useState<TransactionIntent>();
  const [riskReport, setRiskReport] = useState<RiskReport>();
  const [toolTrace, setToolTrace] = useState<ToolTraceEntry[]>([]);
  const [error, setError] = useState("");

  const buildIntent = () => {
    setError("");

    if (!agent.walletAddress) {
      setError("Create the smart wallet before building an intent.");
      return;
    }

    try {
      const nextIntent = createTransactionIntent({
        agentId: agent.id,
        chainId: mantleSepolia.id,
        task,
        tokenAddress: tokenAddress as `0x${string}`,
        tokenDecimals: 6,
        tokenSymbol: "USDC",
      });

      setIntent(nextIntent);
      const nextRiskReport = analyzeRiskLocally(
        nextIntent,
        getAgentPolicy(agent),
        agent.walletAddress,
      );
      setRiskReport(nextRiskReport);
      setToolTrace(toolTraceForRun(agent, nextIntent, nextRiskReport));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not create transaction intent.",
      );
    }
  };

  return (
    <section className="intent-builder-card" aria-label="Intent builder">
      <div className="console-topline">
        <span>Transaction Intent</span>
        <span className="status-pill status-ready">Ready</span>
      </div>

      <TaskInputBox
        task={task}
        tokenAddress={tokenAddress}
        onTaskChange={setTask}
        onTokenAddressChange={setTokenAddress}
      />

      <button
        className="primary-action form-submit"
        disabled={!isOwner}
        onClick={buildIntent}
        type="button"
      >
        Build Intent
      </button>

      {!isOwner && (
        <p className="ownership-note">
          Only the owner wallet can build intents for this smart wallet.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      <ToolTracePanel trace={toolTrace} />
      {intent && <TransactionIntentCard intent={intent} />}
      {riskReport && <RiskReportPanel report={riskReport} />}
    </section>
  );
}
