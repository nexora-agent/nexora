import type { ExecutionRecord, ObjectiveRun, ReputationStats } from "@nexora/shared";
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentReputationRegistryAbi,
  nexoraReputationAbi,
} from "@/lib/contracts/abis";
import {
  isNexoraMockWallet,
  shouldFallbackToDemoWrite,
} from "@/lib/contracts/onchainAgents";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

export async function recordReputationRunOnchain(
  run: ObjectiveRun,
  execution: ExecutionRecord,
) {
  if (isNexoraMockWallet()) {
    throw new Error("Nexora mock wallet uses demo reputation.");
  }

  if (!run.riskReport || !run.benchmarkScore) {
    throw new Error("Reputation requires risk and benchmark scores.");
  }

  const transactionHash = await writeContract(wagmiConfig, {
    address: mantleSepoliaContracts.reputation,
    abi: nexoraReputationAbi,
    functionName: "recordRun",
    args: [
      BigInt(run.agentId),
      execution.status === "executed",
      run.riskReport.policyDecision === "blocked",
      run.riskReport.riskScore,
      run.benchmarkScore.finalScore,
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

export async function readReputationStatsOnchain(
  agentId: string,
): Promise<ReputationStats> {
  const reputation = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.agentReputationRegistry,
    abi: nexoraAgentReputationRegistryAbi,
    functionName: "getReputation",
    args: [BigInt(agentId)],
    chainId: mantleSepolia.id,
  });

  const benchmarkRuns = Number(reputation.benchmarkRuns);
  const averageRiskScore =
    benchmarkRuns > 0
      ? Math.round(Number(reputation.totalRiskScore) / benchmarkRuns)
      : 0;
  const averageBenchmarkScore =
    benchmarkRuns > 0
      ? Math.round(Number(reputation.totalBenchmarkScore) / benchmarkRuns)
      : 0;

  return {
    averageBenchmarkScore,
    averageRiskScore,
    benchmarkRuns,
    blockedActions: Number(reputation.blockedExecutions),
    policyViolations: Number(reputation.policyViolations),
    safeActions: Number(reputation.safeExecutions),
    source: "onchain",
    trustScore: Number(reputation.trustScore),
  };
}

export async function readAgentReputationCountersOnchain(agentId: string) {
  return readReputationStatsOnchain(agentId);
}

export function canFallbackReputation(caughtError: unknown) {
  return shouldFallbackToDemoWrite(caughtError);
}
