import type {
  AgentRecord,
  AgentProposal,
  ObjectiveRun,
  RiskReport,
  ToolTraceEntry,
  TransactionIntent,
} from "@nexora/shared";
import { attachReportEnvelope, createTransactionIntent, hashIntent } from "@nexora/shared";
import { parseEther } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { getAgentPolicy } from "@/lib/agents/localAgentRegistry";
import { scoreBenchmarkRun } from "@/lib/benchmark/scoreBenchmarkRun";
import {
  createMntVaultDepositIntent,
  getMntVaultByName,
  nexoraMntVaults,
  rejectedMntVaults,
  selectMntVault,
} from "@/lib/benchmark/mntVaults";
import {
  compareByrealOpportunities,
  createByrealPreview,
  getByrealStatus,
  inspectByrealPool,
  listByrealPools,
} from "@/lib/byreal/byrealAdapter";
import { getExternalDefiEligibility } from "@/lib/byreal/externalDefiEligibility";
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
  if (input.intent.kind === "mnt_vault_deposit") {
    return {
      id: `proposal-${input.intent.intentHash.slice(2, 10)}`,
      agentId: input.agent.id,
      harnessId: input.harnessId,
      actionType: input.intent.kind,
      asset: "MNT",
      target: input.intent.target,
      targetVault: input.intent.metadata?.targetVault,
      token: "MNT",
      amount: input.intent.amount,
      rejectedOptions: input.intent.metadata?.rejectedOptions,
      reasoning:
        input.intent.metadata?.modelReasoning ??
        `${input.intent.metadata?.targetVault} has ${input.intent.metadata?.vaultRiskProfile} benchmark risk and fits the ${input.agent.riskMode} policy for a controlled MNT test.`,
      intentHash: input.intent.intentHash,
      intent: input.intent,
      toolTrace: input.toolTrace,
    };
  }

  if (input.intent.kind.startsWith("byreal_")) {
    return {
      id: `proposal-${input.intent.intentHash.slice(2, 10)}`,
      agentId: input.agent.id,
      harnessId: input.harnessId,
      actionType: input.intent.kind,
      amount: input.intent.amount,
      asset: input.intent.metadata?.asset ?? "MNT",
      executionMode: input.intent.metadata?.executionMode,
      expectedYield: input.intent.metadata?.expectedYield,
      liveExecutionEnabled: input.intent.metadata?.liveExecutionEnabled,
      mode: input.intent.metadata?.mode,
      poolName: input.intent.metadata?.poolName,
      protocol: input.intent.metadata?.protocol,
      reasoning:
        input.intent.kind === "byreal_action_reject"
          ? "External DeFi inspection is locked until the smart wallet passes the controlled MNT benchmark. Nexora produced a dry-run rejection proposal instead of enabling live action."
          : `${input.intent.metadata?.poolName} was selected for a bounded dry-run Byreal / RealClaw proposal. Nexora keeps live execution disabled and applies policy/risk scoring before any external DeFi mode can be considered.`,
      riskHints: input.intent.metadata?.riskHints,
      target: input.intent.target,
      token: input.intent.tokenSymbol,
      intentHash: input.intent.intentHash,
      intent: input.intent,
      toolTrace: input.toolTrace,
    };
  }

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

function isMntBenchmarkObjective(objective: string) {
  const normalized = objective.toLowerCase();
  return (
    normalized.includes("mnt") ||
    normalized.includes("vault") ||
    normalized.includes("safe yield test") ||
    normalized.includes("risk trap") ||
    normalized.includes("vault comparison")
  );
}

function mntToolTraceForObjective(
  agent: AgentRecord,
  intent: TransactionIntent,
  report: RiskReport,
): ToolTraceEntry[] {
  const selectedVault = intent.metadata?.targetVault ?? "NexoraSafeVault";
  const trace: ToolTraceEntry[] = [
    {
      index: 1,
      status: "success",
      summary: `Read MNT balance for ${agent.walletAddress ?? "smart wallet"} using the wallet balance system.`,
      toolName: "get_mnt_balance",
    },
    {
      index: 2,
      status: "success",
      summary: `Loaded ${nexoraMntVaults.length} verified Nexora benchmark vaults.`,
      toolName: "inspect_nexora_vaults",
    },
  ];

  if (intent.metadata?.modelDecisionSource === "llm") {
    trace.push({
      index: 3,
      status: "success",
      summary: `${intent.metadata.modelName ?? "Local model"} selected ${intent.metadata.modelSelectedVault ?? selectedVault}${intent.metadata.modelLatencyMs ? ` in ${intent.metadata.modelLatencyMs}ms` : ""}.`,
      toolName: "ask_configured_model",
    });
  }

  trace.push(
    {
      index: trace.length + 1,
      status: "success",
      summary: `Compared vaults and selected ${selectedVault}; rejected ${rejectedMntVaults(nexoraMntVaults.find((vault) => vault.name === selectedVault) ?? nexoraMntVaults[0]).map((vault) => vault.name).join(", ")}.`,
      toolName: "compare_nexora_vaults",
    },
    {
      index: trace.length + 2,
      status: "success",
      summary: intent.summary,
      toolName: "create_mnt_deposit_intent",
    },
    {
      index: trace.length + 3,
      status: "success",
      summary: `Risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
      toolName: "analyze_risk",
    },
  );

  return trace;
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
  const status = getByrealStatus();
  const eligibility = getExternalDefiEligibility(agent);

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
      summary: `Byreal / RealClaw adapter mode ${status.adapterMode}; live execution disabled.`,
      toolName: "get_byreal_status",
    },
    {
      index: 4,
      status: "success",
      summary: `Loaded ${listByrealPools().length} Byreal / RealClaw demo pools.`,
      toolName: "list_byreal_pools",
    },
    {
      index: 5,
      status: "success",
      summary: `Inspected ${pool.name}; ${pool.riskNote}`,
      toolName: "inspect_byreal_pool",
    },
    {
      index: 6,
      status: "success",
      summary: `Compared opportunities and selected ${compareByrealOpportunities()[0].name}.`,
      toolName: "compare_byreal_opportunities",
    },
    {
      index: 7,
      status: "success",
      summary:
        intent.kind === "byreal_action_reject"
          ? `External DeFi eligibility checked: ${eligibility.reason}`
          : `Created dry-run Byreal / RealClaw action for ${pool.name}.`,
      toolName: "create_byreal_action_intent",
    },
    {
      index: 8,
      status: "success",
      summary: `Byreal action risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
      toolName: "analyze_byreal_action_risk",
    },
  ];
}

function createByrealDryRunIntent(agent: AgentRecord, objective: string): TransactionIntent {
  const pool = inspectByrealPool(objective);
  const preview = createByrealPreview(pool, "0.01");
  const eligibility = getExternalDefiEligibility(agent);
  const isLocked = eligibility.status === "locked";
  const kind = isLocked ? "byreal_action_reject" : "byreal_lp_deposit_preview";
  const intentWithoutHash = {
    agentId: agent.id,
    amount: preview.amount,
    amountBaseUnits: parseEther(preview.amount).toString(),
    calldata: "0x" as const,
    chainId: mantleSepolia.id,
    kind,
    metadata: {
      asset: preview.asset,
      executionMode: "dry_run" as const,
      expectedYield: preview.expectedYield,
      liveExecutionEnabled: false,
      mode: "demo" as const,
      poolName: preview.poolName,
      protocol: "byreal",
      riskHints: [
        ...preview.riskHints,
        isLocked ? "benchmark eligibility required" : "benchmark eligible for dry-run",
      ],
    },
    summary: isLocked
      ? `Reject external DeFi action for ${pool.name} until MNT benchmark eligibility is met`
      : `Dry-run Byreal / RealClaw LP preview for ${preview.amount} MNT in ${pool.name}`,
    target: preview.target,
    tokenAddress: "0x0000000000000000000000000000000000000000" as const,
    tokenDecimals: 18,
    tokenSymbol: "MNT",
  } satisfies Omit<TransactionIntent, "intentHash">;

  return {
    ...intentWithoutHash,
    intentHash: hashIntent(intentWithoutHash),
  };
}

export function runObjectiveLocally(
  agent: AgentRecord,
  objective: string,
): ObjectiveRun {
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  if (harness.id === "byreal-defi" || objective.toLowerCase().includes("byreal") || objective.toLowerCase().includes("realclaw")) {
    const intent = createByrealDryRunIntent(agent, objective);
    const riskReport = analyzeRiskLocally(intent, getAgentPolicy(agent), agent.walletAddress);
    const toolTrace = byrealToolTraceForObjective(agent, intent, riskReport, objective);
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

    return attachReportEnvelope({
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
      summary:
        intent.kind === "byreal_action_reject"
          ? "External DeFi inspection is locked until the smart wallet passes the MNT benchmark. A dry-run rejection report was generated."
          : `${intent.summary}. Generated inside ${harness.name}; live execution disabled.`,
    });
  }

  if (isMntBenchmarkObjective(objective)) {
    return runMntBenchmarkWithDecision(agent, objective);
  }

  const intent = createTransactionIntent({
    agentId: agent.id,
    chainId: mantleSepolia.id,
    task: normalizeObjective(objective),
    tokenAddress: defaultTokenAddress,
    tokenDecimals: 6,
    tokenSymbol: "USDC",
  });
  const riskReport = analyzeRiskLocally(intent, getAgentPolicy(agent), agent.walletAddress);
  const toolTrace = toolTraceForObjective(agent, intent, riskReport);
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

  return attachReportEnvelope({
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
  });
}

export function runMntBenchmarkWithDecision(
  agent: AgentRecord,
  objective: string,
  decision?: {
    benchmarkLevel?: "basic_safety" | "adversarial_yield_trap" | "external_defi_readiness";
    benchmarkUnlock?: "none" | "benchmark_complete" | "external_defi_dry_run";
    failure?: boolean;
    graderWarnings?: string[];
    hallucination?: boolean;
    inconsistent?: boolean;
    latencyMs?: number;
    modelName?: string;
    prompt?: string;
    rawResponse?: string;
    reasoning?: string;
    rejectedVaults?: string[];
    selectedVaultName?: string;
    source?: "demo" | "llm";
  },
): ObjectiveRun {
  const harness = getHarnessTemplate(agent.selectedHarnessId);
  const selectedVault =
    getMntVaultByName(decision?.selectedVaultName) ??
    (decision?.failure ? getMntVaultByName("NexoraRiskyVault") : undefined) ??
    selectMntVault(agent);
  const intent = createMntVaultDepositIntent({
    agent,
    amount: "0.01",
    benchmarkName: "AI MNT Strategy Benchmark",
    modelDecision: decision
      ? {
          failure: decision.failure,
          benchmarkLevel: decision.benchmarkLevel,
          benchmarkUnlock: decision.benchmarkUnlock,
          graderWarnings: decision.graderWarnings,
          hallucination: decision.hallucination,
          inconsistent: decision.inconsistent,
          latencyMs: decision.latencyMs,
          modelName: decision.modelName,
          prompt: decision.prompt,
          rawResponse: decision.rawResponse,
          reasoning: decision.reasoning,
          rejectedVaults: decision.rejectedVaults,
          selectedVault: decision.selectedVaultName,
          source: decision.source ?? "demo",
        }
      : undefined,
    selectedVault,
  });
  const riskReport = analyzeRiskLocally(intent, getAgentPolicy(agent), agent.walletAddress);
  const toolTrace = mntToolTraceForObjective(agent, intent, riskReport);
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

  return attachReportEnvelope({
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
    summary: decision?.failure
      ? "The model did not return a valid benchmark decision. Nexora scored this as a failed strategy selection."
      : `Selected ${selectedVault.name} for the AI MNT benchmark. Rejected ${intent.metadata?.rejectedOptions?.map((vault) => vault.name).join(", ")}.`,
  });
}
