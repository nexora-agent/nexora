import type { AgentRecord, ObjectiveRun, PolicyProfile } from "@nexora/shared";
import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexoraAgentWalletAbi } from "@/lib/contracts/abis";
import {
  isNexoraMockWallet,
  shouldFallbackToDemoWrite,
} from "@/lib/contracts/onchainAgents";
import { buildRegistryRecord } from "@/lib/registry/buildRegistryRecord";
import { wagmiConfig } from "@/lib/wagmi/config";

function executionCallForRun(run: ObjectiveRun): {
  target: Address;
  value: bigint;
  data: `0x${string}`;
} {
  if (!run.intent) {
    throw new Error("Execution requires an intent.");
  }

  if (run.intent.kind === "mnt_vault_deposit") {
    return {
      data: run.intent.calldata,
      target: run.intent.target,
      value: BigInt(run.intent.amountBaseUnits),
    };
  }

  if (run.intent.kind === "mnt_vault_withdraw") {
    return {
      data: run.intent.calldata,
      target: run.intent.target,
      value: 0n,
    };
  }

  if (run.intent.kind === "erc20_approval" || run.intent.kind === "erc20_transfer") {
    return {
      data: run.intent.calldata,
      target: run.intent.tokenAddress,
      value: 0n,
    };
  }

  throw new Error("This proposal type is preview-only and cannot be executed.");
}

export async function executeRunOnchain(
  agent: AgentRecord,
  run: ObjectiveRun,
  policy: PolicyProfile,
) {
  if (isNexoraMockWallet()) {
    throw new Error("Nexora mock wallet uses demo execution.");
  }

  if (!agent.walletAddress) {
    throw new Error("Create a smart wallet before execution.");
  }

  if (!run.intent || !run.riskReport) {
    throw new Error("Execution requires an intent and risk report.");
  }

  const registryRecord = buildRegistryRecord(run);
  if (!registryRecord) {
    throw new Error("Execution requires a registry-ready report.");
  }
  const executionCall = executionCallForRun(run);

  const transactionHash = await writeContract(wagmiConfig, {
    address: agent.walletAddress,
    abi: nexoraAgentWalletAbi,
    functionName: "executeWithRiskReport",
    args: [
      executionCall.target,
      executionCall.value,
      executionCall.data,
      run.intent.intentHash,
      policy.maxRiskScore,
      {
        intentHash: run.riskReport.intentHash,
        policyPassed: run.riskReport.policyDecision === "passed",
        reportHash: registryRecord.reportHash,
        riskScore: run.riskReport.riskScore,
      },
    ],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  return transactionHash;
}

export function canFallbackExecution(caughtError: unknown) {
  return shouldFallbackToDemoWrite(caughtError);
}
