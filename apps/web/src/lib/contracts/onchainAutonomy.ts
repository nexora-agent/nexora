import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { parseEther, zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexora4337AgentWalletAbi } from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

function requireV2Wallet(walletAddress?: `0x${string}`) {
  if (!walletAddress || walletAddress.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new Error("Create a V2 smart wallet before enabling autonomy.");
  }

  return walletAddress;
}

async function waitForMantle(hash: `0x${string}`, label: string) {
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    chainId: mantleSepolia.id,
    hash,
    timeout: 120_000,
  });

  if (receipt.status === "reverted") {
    throw new Error(`${label} reverted on Mantle.`);
  }

  return receipt;
}

export async function saveExecutorPolicyOnchain({
  dailyLimitMnt,
  enabled,
  executor,
  maxValuePerActionMnt,
  validForHours,
  walletAddress,
}: {
  dailyLimitMnt: string;
  enabled: boolean;
  executor: `0x${string}`;
  maxValuePerActionMnt: string;
  validForHours: number;
  walletAddress?: `0x${string}`;
}) {
  const hash = await writeContract(wagmiConfig, {
    abi: nexora4337AgentWalletAbi,
    address: requireV2Wallet(walletAddress),
    args: [
      executor,
      enabled,
      true,
      parseEther(maxValuePerActionMnt),
      parseEther(dailyLimitMnt),
      BigInt(Math.floor(Date.now() / 1000) + validForHours * 60 * 60),
    ],
    chainId: mantleSepolia.id,
    functionName: "setExecutorPolicy",
  });

  await waitForMantle(hash, "Executor policy");
  return hash;
}

export async function allowAutonomousTargetOnchain({
  allowed,
  target,
  walletAddress,
}: {
  allowed: boolean;
  target: Address;
  walletAddress?: `0x${string}`;
}) {
  const hash = await writeContract(wagmiConfig, {
    abi: nexora4337AgentWalletAbi,
    address: requireV2Wallet(walletAddress),
    args: [target, allowed],
    chainId: mantleSepolia.id,
    functionName: "setAllowedTarget",
  });

  await waitForMantle(hash, "Allowed target");
  return hash;
}

export async function allowBenchmarkVaultsOnchain(walletAddress?: `0x${string}`) {
  const targets = [
    mantleSepoliaContracts.safeVault,
    mantleSepoliaContracts.volatileVault,
    mantleSepoliaContracts.riskyVault,
  ].filter((target) => target.toLowerCase() !== zeroAddress.toLowerCase()) as Address[];

  const hashes: `0x${string}`[] = [];
  for (const target of targets) {
    hashes.push(
      await allowAutonomousTargetOnchain({
        allowed: true,
        target,
        walletAddress,
      }),
    );
  }

  return hashes;
}
