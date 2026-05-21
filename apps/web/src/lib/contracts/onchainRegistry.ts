import type { OnchainReportRecord } from "@nexora/shared";
import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { keccak256, toBytes } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexoraRiskRegistryAbi } from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

function idToBytes32(value: string) {
  return keccak256(toBytes(value));
}

export async function recordRiskReportOnchain(record: OnchainReportRecord) {
  const transactionHash = await writeContract(wagmiConfig, {
    address: mantleSepoliaContracts.riskRegistry,
    abi: nexoraRiskRegistryAbi,
    functionName: "recordReport",
    args: [
      BigInt(record.agentId),
      idToBytes32(record.harnessId),
      idToBytes32(record.objectiveRunId),
      record.intentHash,
      record.riskScore,
      record.policyDecision === "passed",
      record.benchmarkScore,
      record.reportHash,
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
