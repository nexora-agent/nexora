import { createTransactionIntent } from "@nexora/shared";
import { analyzeRisk } from "../risk/riskEngine";
import { getHarnessTemplate } from "../harness/harnessTemplates";
import { getByrealPools, inspectByrealPool } from "../byreal/byrealAdapter";
import type { NexoraTool } from "./toolTypes";

const allHarnesses = ["safe-approval", "wallet-defense", "safe-yield", "byreal-defi"];
const defaultTokenAddress = "0x0000000000000000000000000000000000000002";
const defaultRecipient = "0x0000000000000000000000000000000000000003";
const defaultApprovalTarget = "0x0000000000000000000000000000000000000004";

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
    name: "create_transfer_intent",
    description: "Create an ERC-20 transfer transaction intent from a task.",
    harnessIds: ["wallet-defense", "safe-yield"],
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
    name: "get_byreal_pools",
    description: "List supported Byreal-style pool opportunities.",
    harnessIds: ["byreal-defi"],
    execute: () => {
      const pools = getByrealPools();

      return {
        summary: `Loaded ${pools.length} Byreal-style pools.`,
        data: pools,
      };
    },
  },
  {
    name: "inspect_byreal_pool",
    description: "Inspect a Byreal-style pool before proposing an action.",
    harnessIds: ["byreal-defi"],
    execute: (_context, input, state) => {
      const pool = inspectByrealPool(input.task?.includes("stable") ? "byreal-usdc-usdt-stable" : undefined);
      state.byrealPoolId = pool.id;

      return {
        summary: `Inspected ${pool.name}; ${pool.riskNote}`,
        data: pool,
      };
    },
  },
  {
    name: "create_byreal_swap_intent",
    description: "Create a bounded Byreal-style swap intent proposal.",
    harnessIds: ["byreal-defi"],
    execute: (context, input, state) => {
      const pool = inspectByrealPool(state.byrealPoolId);
      const intent = createTransactionIntent({
        agentId: context.agentId,
        chainId: 5003,
        task: `Send 10 USDC to ${pool.address}`,
        tokenAddress: input.tokenAddress ?? defaultTokenAddress,
        tokenDecimals: input.tokenDecimals ?? 6,
        tokenSymbol: input.tokenSymbol ?? "USDC",
      });
      state.intent = intent;

      return {
        summary: `Created bounded Byreal swap intent for ${pool.pair}.`,
        data: {
          intent,
          pool,
        },
      };
    },
  },
  {
    name: "analyze_byreal_action_risk",
    description: "Analyze a Byreal-style action with Nexora risk scoring.",
    harnessIds: ["byreal-defi"],
    execute: (context, _input, state) => {
      if (!state.intent) {
        return {
          summary: "No Byreal intent was available for risk analysis.",
        };
      }

      const report = analyzeRisk(state.intent, context.policy, context.walletAddress);

      return {
        summary: `Byreal action risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
        data: report,
      };
    },
  },
  {
    name: "analyze_risk",
    description: "Analyze the active intent with deterministic Nexora risk rules.",
    harnessIds: allHarnesses,
    execute: (context, _input, state) => {
      if (!state.intent) {
        return {
          summary: "No intent was available for risk analysis.",
        };
      }

      const report = analyzeRisk(state.intent, context.policy, context.walletAddress);

      return {
        summary: `Risk score ${report.riskScore}/100; policy ${report.policyDecision}.`,
        data: report,
      };
    },
  },
];

export function listToolsForHarness(harnessId: string) {
  return toolRegistry
    .filter((tool) => tool.harnessIds.includes(harnessId))
    .map(({ description, harnessIds, name }) => ({
      description,
      harnessIds,
      name,
    }));
}

export function getTool(name: string) {
  return toolRegistry.find((tool) => tool.name === name);
}
