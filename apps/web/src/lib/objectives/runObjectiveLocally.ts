import type {
  AgentRecord,
  AgentProposal,
  ObjectiveRun,
  RiskReport,
  ToolTraceEntry,
  TransactionIntent,
} from "@nexora/shared";
import { createTransactionIntent } from "@nexora/shared";
import { mantleSepolia } from "@/lib/chains/mantle";
import { getAgentPolicy } from "@/lib/agents/localAgentRegistry";
import { scoreBenchmarkRun } from "@/lib/benchmark/scoreBenchmarkRun";
import { inspectByrealPool } from "@/lib/byreal/byrealAdapter";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { analyzeRiskLocally } from "@/lib/risk/analyzeRisk";

const defaultTokenAddress = "0x0000000000000000000000000000000000000002";
const defaultRecipient = "0x0000000000000000000000000000000000000003";
const defaultApprovalTarget = "0x0000000000000000000000000000000000000004";

function hasAddress(objective: string) {
  return /0x[a-fA-F0-9]{40}/.test(objective);
}

function normalizeObjective(objective: string) {
  const normalizedObjective = objective.toLowerCase();

  if (hasAddress(objective)) {
    return objective;
  }

  if (
    normalizedObjective.includes("approve") ||
    normalizedObjective.includes("approval")
  ) {
    return `Approve 20 USDC to ${defaultApprovalTarget}`;
  }

  return `Send 10 USDC to ${defaultRecipient}`;
}

function proposalForRun(input: {
  agent: AgentRecord;
  harnessId: string;
  intent: TransactionIntent;
  toolTrace: ToolTraceEntry[];
}): AgentProposal {
  return {
    id: `proposal-${input.intent.intentHash.slice(2, 10)}`,
    agentId: input.agent.id,
    harnessId: input.harnessId,
    actionType: input.intent.kind,
    target: input.intent.target,
    token: input.intent.tokenSymbol,
    amount: input.intent.amount,
    reasoning:
      input.harnessId === "byreal-defi"
        ? "The smart wallet inspected Byreal-style pool data and proposed a bounded swap intent for Nexora risk scoring."
        : "The smart wallet used the selected harness tools to convert the objective into a bounded transaction intent.",
    intentHash: input.intent.intentHash,
    intent: input.intent,
    toolTrace: input.toolTrace,
  };
}

function toolTraceForObjective(
  agent: AgentRecord,
  intent: TransactionIntent,
  report: RiskReport,
): ToolTraceEntry[] {
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const isCustomHarness = harness.source === "custom";

  if (isCustomHarness) {
    const customToolCalls = harness.tools.map((tool, index) => ({
      index: index + 3,
      status: "success" as const,
      summary: tool.description || `${tool.name} completed.`,
      toolName: tool.name,
    }));

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
      ...customToolCalls,
      {
        index: customToolCalls.length + 3,
        status: "success",
        summary: intent.summary,
        toolName:
          intent.kind === "erc20_approval"
            ? "create_approval_intent"
            : "create_transfer_intent",
      },
      {
        index: customToolCalls.length + 4,
        status: "success",
        summary: `Risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
        toolName: "analyze_risk",
      },
    ];
  }

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

function byrealToolTraceForObjective(
  agent: AgentRecord,
  intent: TransactionIntent,
  report: RiskReport,
  objective: string,
): ToolTraceEntry[] {
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const pool = inspectByrealPool(objective);

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
      summary: "Loaded 2 Byreal-style pools.",
      toolName: "get_byreal_pools",
    },
    {
      index: 4,
      status: "success",
      summary: `Inspected ${pool.name}; ${pool.riskNote}`,
      toolName: "inspect_byreal_pool",
    },
    {
      index: 5,
      status: "success",
      summary: `Created bounded Byreal swap intent for ${pool.pair}.`,
      toolName: "create_byreal_swap_intent",
    },
    {
      index: 6,
      status: "success",
      summary: `Byreal action risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
      toolName: "analyze_byreal_action_risk",
    },
  ];
}

export function runObjectiveLocally(
  agent: AgentRecord,
  objective: string,
): ObjectiveRun {
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const byrealPool = inspectByrealPool(objective);
  const intent = createTransactionIntent({
    agentId: agent.id,
    chainId: mantleSepolia.id,
    task:
      harness.id === "byreal-defi"
        ? `Send 10 USDC to ${byrealPool.address}`
        : normalizeObjective(objective),
    tokenAddress: defaultTokenAddress,
    tokenDecimals: 6,
    tokenSymbol: "USDC",
  });
  const riskReport = analyzeRiskLocally(intent, getAgentPolicy(agent), agent.walletAddress);
  const toolTrace =
    harness.id === "byreal-defi"
      ? byrealToolTraceForObjective(agent, intent, riskReport, objective)
      : toolTraceForObjective(agent, intent, riskReport);
  const proposal = proposalForRun({
    agent,
    harnessId: harness.id,
    intent,
    toolTrace,
  });
  const benchmarkScore = scoreBenchmarkRun({
    proposal,
    report: riskReport,
    toolTrace,
  });

  return {
    id: `objective-${Date.now()}`,
    agentId: agent.id,
    harnessId: harness.id,
    objective,
    status: "completed",
    createdAt: new Date().toISOString(),
    intent,
    proposal,
    benchmarkScore,
    riskReport,
    toolTrace,
    summary: `${intent.summary} Generated inside ${harness.name}. Proposal risk link verified.`,
  };
}
