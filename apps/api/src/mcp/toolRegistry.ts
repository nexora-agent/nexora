import { createTransactionIntent, hashIntent } from "@nexora/shared";
import { analyzeRisk } from "../risk/riskEngine";
import {
  compareMntVaults,
  createMntVaultDepositIntent,
  createMntVaultWithdrawIntent,
  getMntVaultByName,
  mntVaultProfiles,
} from "../benchmark/mntVaults";
import { getHarnessTemplate } from "../harness/harnessTemplates";
import {
  compareByrealOpportunitiesReadOnly,
  createByrealActionPreview,
  getByrealStatusTool,
  inspectByrealPoolReadOnly,
  listByrealPoolsReadOnly,
} from "../integrations/byreal";
import type { NexoraTool } from "./toolTypes";

const allHarnesses = ["safe-approval", "wallet-defense", "safe-yield", "byreal-defi"];
const defaultTokenAddress = "0x0000000000000000000000000000000000000002";
const defaultRecipient = "0x0000000000000000000000000000000000000003";
const defaultApprovalTarget = "0x0000000000000000000000000000000000000004";

function parseMntAmount(amount: string) {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = `${fraction}000000000000000000`.slice(0, 18);
  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "");
}

function hasAddress(task: string) {
  return /0x[a-fA-F0-9]{40}/.test(task);
}

function normalizeApprovalTask(task: string) {
  return hasAddress(task) ? task : `Approve 20 USDC to ${defaultApprovalTarget}`;
}

function normalizeTransferTask(task: string) {
  return hasAddress(task) ? task : `Send 10 USDC to ${defaultRecipient}`;
}

export const toolRegistry: NexoraTool[] = [
  {
    name: "get_agent_profile",
    description: "Read the active agent profile for the tool loop.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: (context) => ({
      summary: `Loaded agent ${context.agentName ?? context.agentId}.`,
      data: {
        agentId: context.agentId,
        agentName: context.agentName,
        walletAddress: context.walletAddress,
      },
    }),
  },
  {
    name: "get_harness_config",
    description: "Read the selected harness tools, rules, and scoring config.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: (context) => {
      const harness = getHarnessTemplate(context.harnessId);

      return {
        summary: `Loaded ${harness?.name ?? context.harnessId}.`,
        data: harness,
      };
    },
  },
  {
    name: "get_wallet_balance",
    description: "Read the agent smart wallet balance in the Mantle context.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: (context) => ({
      summary: context.walletAddress
        ? `Read demo balance for ${context.walletAddress}.`
        : "No wallet address was available.",
      data: {
        balance: context.walletAddress ? "0" : undefined,
        tokenSymbol: "USDC",
        walletAddress: context.walletAddress,
      },
    }),
  },
  {
    name: "get_mnt_balance",
    description: "Read the smart wallet MNT balance for Mantle benchmark tasks.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: (context) => ({
      summary: context.walletAddress
        ? `Read MNT balance for ${context.walletAddress}.`
        : "No wallet address was available.",
      data: {
        balance: "0",
        balanceSource: "demo",
        network: "mantle-sepolia",
        tokenSymbol: "MNT",
        walletAddress: context.walletAddress,
      },
    }),
  },
  {
    name: "inspect_nexora_vaults",
    description: "Inspect the verified Nexora MNT benchmark vaults.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: () => ({
      summary: `Loaded ${mntVaultProfiles.length} verified Nexora benchmark vaults.`,
      data: {
        network: "mantle-sepolia",
        vaults: mntVaultProfiles,
      },
    }),
  },
  {
    name: "compare_nexora_vaults",
    description: "Compare MNT vaults by risk-adjusted score and active policy.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: (context, _input, state) => {
      const comparison = compareMntVaults(context.policy);
      state.selectedMntVault = comparison.selected.name;

      return {
        summary: `Compared vaults and selected ${comparison.selected.name}; rejected ${comparison.rejected.map((vault) => vault.name).join(", ")}.`,
        data: comparison,
      };
    },
  },
  {
    name: "create_mnt_deposit_intent",
    description: "Create a benchmark MNT deposit intent for a selected vault.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "string",
          description: "MNT amount, for example 0.01.",
        },
        selectedVault: {
          type: "string",
          enum: mntVaultProfiles.map((vault) => vault.name),
        },
      },
    },
    execute: (context, input, state) => {
      const vaultName =
        input.selectedVault ?? state.selectedMntVault ?? "NexoraSafeVault";
      const vault = getMntVaultByName(vaultName);

      if (!vault) {
        return {
          summary: `Vault ${vaultName} was not found.`,
        };
      }

      const intent = createMntVaultDepositIntent({
        agentId: context.agentId,
        amount: input.amount ?? "0.01",
        vault,
      });
      state.intent = intent;

      return {
        summary: intent.summary,
        data: intent,
      };
    },
  },
  {
    name: "create_mnt_withdraw_intent",
    description: "Create a benchmark MNT withdraw intent for a selected vault.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "string",
          description: "MNT amount, for example 0.01.",
        },
        selectedVault: {
          type: "string",
          enum: mntVaultProfiles.map((vault) => vault.name),
        },
      },
    },
    execute: (context, input, state) => {
      const vaultName =
        input.selectedVault ?? state.selectedMntVault ?? "NexoraSafeVault";
      const vault = getMntVaultByName(vaultName);

      if (!vault) {
        return {
          summary: `Vault ${vaultName} was not found.`,
        };
      }

      const intent = createMntVaultWithdrawIntent({
        agentId: context.agentId,
        amount: input.amount ?? "0.01",
        vault,
      });
      state.intent = intent;

      return {
        summary: intent.summary,
        data: intent,
      };
    },
  },
  {
    name: "create_transfer_intent",
    description: "Create an ERC-20 transfer transaction intent from a task.",
    harnessIds: ["wallet-defense", "safe-yield"],
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
        },
        tokenAddress: {
          type: "string",
        },
        tokenDecimals: {
          type: "number",
        },
        tokenSymbol: {
          type: "string",
        },
      },
    },
    execute: (context, input, state) => {
      const intent = createTransactionIntent({
        agentId: context.agentId,
        chainId: 5003,
        task: normalizeTransferTask(input.task ?? ""),
        tokenAddress: input.tokenAddress ?? defaultTokenAddress,
        tokenDecimals: input.tokenDecimals ?? 6,
        tokenSymbol: input.tokenSymbol ?? "USDC",
      });
      state.intent = intent;

      return {
        summary: intent.summary,
        data: intent,
      };
    },
  },
  {
    name: "create_approval_intent",
    description: "Create an ERC-20 approval transaction intent from a task.",
    harnessIds: ["safe-approval", "wallet-defense", "byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
        },
        tokenAddress: {
          type: "string",
        },
        tokenDecimals: {
          type: "number",
        },
        tokenSymbol: {
          type: "string",
        },
      },
    },
    execute: (context, input, state) => {
      const intent = createTransactionIntent({
        agentId: context.agentId,
        chainId: 5003,
        task: normalizeApprovalTask(input.task ?? ""),
        tokenAddress: input.tokenAddress ?? defaultTokenAddress,
        tokenDecimals: input.tokenDecimals ?? 6,
        tokenSymbol: input.tokenSymbol ?? "USDC",
      });
      state.intent = intent;

      return {
        summary: intent.summary,
        data: intent,
      };
    },
  },
  {
    name: "simulate_intent",
    description: "Simulate the active transaction intent.",
    harnessIds: ["safe-yield", "byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: (_context, _input, state) => ({
      summary: state.intent
        ? `Simulated ${state.intent.summary}.`
        : "No intent was available to simulate.",
      data: {
        simulated: Boolean(state.intent),
        intentHash: state.intent?.intentHash,
      },
    }),
  },
  {
    name: "get_byreal_status",
    description: "Read Byreal / RealClaw adapter status.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: () => {
      const result = getByrealStatusTool();
      return {
        summary: `Byreal / RealClaw adapter mode ${result.result.mode}; live execution disabled.`,
        data: result,
      };
    },
  },
  {
    name: "list_byreal_pools",
    description: "List Byreal / RealClaw pool opportunities through demo, API, or local CLI read-only mode.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const result = await listByrealPoolsReadOnly();
      return {
        summary: `Listed ${result.result.length} Byreal / RealClaw pools in ${result.mode} mode.`,
        data: result,
      };
    },
  },
  {
    name: "get_byreal_pools",
    description: "List supported Byreal-style pool opportunities.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const result = await listByrealPoolsReadOnly();

      return {
        summary: `Loaded ${result.result.length} Byreal / RealClaw pools in ${result.mode} mode.`,
        data: result,
      };
    },
  },
  {
    name: "inspect_byreal_pool",
    description: "Inspect a Byreal-style pool before proposing an action.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {
        poolId: {
          type: "string",
        },
        task: {
          type: "string",
        },
      },
    },
    execute: async (_context, input, state) => {
      const requestedPoolId =
        input.poolId ??
        state.byrealPoolId ??
        (input.task?.toLowerCase().includes("stable")
          ? "byreal-demo-stable"
          : undefined);
      const result = await inspectByrealPoolReadOnly(requestedPoolId);
      state.byrealPoolId = result.result.id;

      return {
        summary: `Inspected ${result.result.name}; ${result.result.riskHints.join(", ")}.`,
        data: result,
      };
    },
  },
  {
    name: "create_byreal_swap_intent",
    description: "Create a bounded Byreal-style swap intent proposal.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "string",
        },
        poolId: {
          type: "string",
        },
        tokenAddress: {
          type: "string",
        },
      },
    },
    execute: async (context, input, state) => {
      const result = await createByrealActionPreview(
        state.byrealPoolId ?? input.poolId,
        input.amount ?? "0.01",
      );
      state.byrealProposal = result.result;
      const amount = result.result.amount;
      const target = result.result.target;
      const intentWithoutHash = {
        agentId: context.agentId,
        amount,
        amountBaseUnits: parseMntAmount(amount),
        calldata: "0x" as const,
        chainId: 5003,
        kind: "byreal_swap_preview" as const,
        metadata: {
          asset: result.result.asset,
          executionMode: "dry_run" as const,
          expectedYield: result.result.expectedYield,
          liveExecutionEnabled: false,
          mode: result.mode,
          poolName: result.result.poolName,
          protocol: "byreal",
          riskHints: result.result.riskHints,
        },
        summary: `Dry-run Byreal / RealClaw swap preview for ${amount} MNT in ${result.result.poolName}`,
        target,
        tokenAddress: "0x0000000000000000000000000000000000000000" as const,
        tokenDecimals: 18,
        tokenSymbol: "MNT",
      };
      state.intent = {
        ...intentWithoutHash,
        intentHash: hashIntent(intentWithoutHash),
      };

      return {
        summary: `Created dry-run Byreal / RealClaw swap preview for ${result.result.poolName}.`,
        data: result,
      };
    },
  },
  {
    name: "compare_byreal_opportunities",
    description: "Compare Byreal / RealClaw opportunities by risk-adjusted yield.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (_context, _input, state) => {
      const result = await compareByrealOpportunitiesReadOnly();
      state.byrealPoolId = result.result[0]?.id;
      return {
        summary: `Compared Byreal / RealClaw opportunities; selected ${result.result[0]?.name}.`,
        data: result,
      };
    },
  },
  {
    name: "create_byreal_action_intent",
    description: "Create a dry-run Byreal / RealClaw action proposal.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "string",
        },
        poolId: {
          type: "string",
        },
      },
    },
    execute: async (context, input, state) => {
      const result = await createByrealActionPreview(
        state.byrealPoolId ?? input.poolId,
        input.amount ?? "0.01",
      );
      state.byrealProposal = result.result;
      const amount = result.result.amount;
      const target = result.result.target;
      const intentWithoutHash = {
        agentId: context.agentId,
        amount,
        amountBaseUnits: parseMntAmount(amount),
        calldata: "0x" as const,
        chainId: 5003,
        kind: "byreal_lp_deposit_preview" as const,
        metadata: {
          asset: "MNT",
          executionMode: "dry_run" as const,
          expectedYield: result.result.expectedYield,
          liveExecutionEnabled: false,
          mode: result.mode,
          poolName: result.result.poolName,
          protocol: "byreal",
          riskHints: result.result.riskHints,
        },
        summary: `Dry-run Byreal / RealClaw LP preview for ${amount} MNT in ${result.result.poolName}`,
        target,
        tokenAddress: "0x0000000000000000000000000000000000000000" as const,
        tokenDecimals: 18,
        tokenSymbol: "MNT",
      };
      state.intent = {
        ...intentWithoutHash,
        intentHash: hashIntent(intentWithoutHash),
      };
      return {
        summary: `Created dry-run Byreal / RealClaw action for ${result.result.poolName}.`,
        data: result,
      };
    },
  },
  {
    name: "analyze_byreal_action_risk",
    description: "Analyze a Byreal-style action with Nexora risk scoring.",
    harnessIds: ["byreal-defi"],
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "object",
          description: "Optional Byreal TransactionIntent for stateless MCP clients.",
        },
      },
    },
    execute: (context, input, state) => {
      const intent = input.intent ?? state.intent;

      if (!intent) {
        return {
          summary: "No Byreal intent was available for risk analysis.",
        };
      }

      state.intent = intent;

      const report = analyzeRisk(intent, context.policy, context.walletAddress);

      return {
        summary: `Byreal action risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
        data: {
          executionMode: "dry_run",
          input: {
            intentHash: intent.intentHash,
          },
          mode: "demo",
          report,
          result: report,
          riskHints: report.flags.map((flag) => flag.label),
          source: "Byreal / RealClaw",
          timestamp: new Date().toISOString(),
          toolName: "analyze_byreal_action_risk",
        },
      };
    },
  },
  {
    name: "analyze_risk",
    description: "Analyze the active intent with deterministic Nexora risk rules.",
    harnessIds: allHarnesses,
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "object",
          description: "Optional TransactionIntent for stateless MCP clients.",
        },
      },
    },
    execute: (context, input, state) => {
      const intent = input.intent ?? state.intent;

      if (!intent) {
        return {
          summary: "No intent was available for risk analysis.",
        };
      }

      state.intent = intent;

      const report = analyzeRisk(intent, context.policy, context.walletAddress);

      return {
        summary: `Risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
        data: report,
      };
    },
  },
];

export function listToolsForHarness(harnessId: string) {
  return toolRegistry
    .filter((tool) => isToolAvailableForHarness(tool, harnessId))
    .map(({ description, harnessIds, inputSchema, name }) => ({
      description,
      harnessIds,
      inputSchema,
      name,
    }));
}

export function getTool(name: string) {
  return toolRegistry.find((tool) => tool.name === name);
}

export function isToolAvailableForHarness(tool: NexoraTool, harnessId: string) {
  return tool.harnessIds.includes(harnessId) || harnessId.startsWith("custom-");
}
