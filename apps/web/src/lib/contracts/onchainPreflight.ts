import type {
  AgentRecord,
  ObjectiveRun,
  PreflightCredential,
  PreflightThresholds,
} from "@nexora/shared";
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentWalletAbi,
  nexoraPreflightRegistryAbi,
} from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
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

  throw new Error("This proposal type is External DeFi Preview only and cannot be executed.");
}

function requirePreflightRegistry() {
  if (
    mantleSepoliaContracts.preflightRegistry.toLowerCase() ===
    zeroAddress.toLowerCase()
  ) {
    throw new Error("Deploy NexoraPreflightRegistry before publishing preflight proofs.");
  }

  return mantleSepoliaContracts.preflightRegistry;
}

export async function recordPreflightOnchain(credential: PreflightCredential) {
  const registryAddress = requirePreflightRegistry();
  const transactionHash = await writeContract(wagmiConfig, {
    address: registryAddress,
    abi: nexoraPreflightRegistryAbi,
    functionName: "recordPreflight",
    args: [
      {
        actionIntentHash: credential.actionIntentHash,
        adversarialScore: credential.adversarialScore,
        averageScore: credential.averageScore,
        basicScore: credential.basicScore,
        externalScore: credential.externalScore,
        harnessHash: credential.harnessHash,
        maxRiskScore: credential.maxRiskScore,
        modelHash: credential.modelHash,
        passed: credential.passed,
        policyHash: credential.policyHash,
        suiteHash: credential.suiteHash,
        toolsHash: credential.toolsHash,
        walletId: BigInt(credential.walletId),
      },
    ],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from preflight registry.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  return transactionHash;
}

export async function executeRunWithPreflightOnchain(
  agent: AgentRecord,
  run: ObjectiveRun,
  credential: PreflightCredential,
) {
  const registryAddress = requirePreflightRegistry();

  if (!agent.walletAddress) {
    throw new Error("Create a smart wallet before execution.");
  }

  if (!run.intent || !run.riskReport) {
    throw new Error("Execution requires an intent and risk report.");
  }

  const executionCall = executionCallForRun(run);
  const transactionHash = await writeContract(wagmiConfig, {
    address: agent.walletAddress,
    abi: nexoraAgentWalletAbi,
    functionName: "executeWithPreflight",
    args: [
      registryAddress,
      executionCall.target,
      executionCall.value,
      executionCall.data,
      credential.actionIntentHash,
      run.riskReport.riskScore,
    ],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet execution.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  return transactionHash;
}

export async function savePreflightThresholdsOnchain(
  walletId: string,
  thresholds: PreflightThresholds,
) {
  const registryAddress = requirePreflightRegistry();
  const transactionHash = await writeContract(wagmiConfig, {
    address: registryAddress,
    abi: nexoraPreflightRegistryAbi,
    functionName: "setPreflightThresholds",
    args: [
      BigInt(walletId),
      thresholds.basicSafetyMinScore,
      thresholds.adversarialYieldTrapMinScore,
      thresholds.externalDefiReadinessMinScore,
      thresholds.averageMinScore,
      thresholds.maxRiskScore,
      thresholds.freshnessMinutes * 60,
    ],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from preflight settings.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  return transactionHash;
}

export async function readPreflightThresholdsOnchain(walletId: string) {
  const registryAddress = requirePreflightRegistry();
  const result = await readContract(wagmiConfig, {
    address: registryAddress,
    abi: nexoraPreflightRegistryAbi,
    functionName: "getPreflightThresholds",
    args: [BigInt(walletId)],
    chainId: mantleSepolia.id,
  });

  return {
    adversarialYieldTrapMinScore: Number(result.adversarialScore),
    averageMinScore: Number(result.averageScore),
    basicSafetyMinScore: Number(result.basicScore),
    externalDefiReadinessMinScore: Number(result.externalScore),
    freshnessMinutes: Math.max(1, Math.round(Number(result.freshnessSeconds) / 60)),
    maxRiskScore: Number(result.maxRiskScore),
    preset: result.exists ? "custom" : "conservative",
  } satisfies PreflightThresholds;
}
