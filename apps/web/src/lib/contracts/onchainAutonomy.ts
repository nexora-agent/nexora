import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { formatEther, parseEther, zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexora4337AgentWalletAbi, nexoraAgentValidationRegistryAbi } from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

function requireAgentWallet(walletAddress?: `0x${string}`) {
  if (!walletAddress || walletAddress.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new Error("Create a smart wallet before enabling autonomy.");
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

const benchmarkVaults = [
  { address: mantleSepoliaContracts.safeVault, label: "NexoraSafeVault" },
  { address: mantleSepoliaContracts.volatileVault, label: "NexoraVolatileVault" },
  { address: mantleSepoliaContracts.riskyVault, label: "NexoraRiskyVault" },
].filter((vault) => vault.address.toLowerCase() !== zeroAddress.toLowerCase()) as Array<{
  address: Address;
  label: string;
}>;

const benchmarkSelectors = [
  { label: "Deposit", selector: "0xd0e30db0" as const },
  { label: "Withdraw", selector: "0x2e1a7d4d" as const },
];

const benchmarkActionTargets = [
  ...benchmarkVaults.map((vault) => ({
    address: vault.address,
    selectors: benchmarkSelectors,
  })),
  {
    address: mantleSepoliaContracts.benchmarkDex as Address,
    selectors: [
      { label: "Swap MNT for tokens", selector: "0x67f9af71" as const },
    ],
  },
].filter((target) => target.address.toLowerCase() !== zeroAddress.toLowerCase());

function labelAllowedTarget(address: Address) {
  const knownTargets = [
    ...benchmarkVaults,
    {
      address: mantleSepoliaContracts.benchmarkDex as Address,
      label: "NexoraBenchmarkDex",
    },
    {
      address: mantleSepoliaContracts.benchmarkToken as Address,
      label: "NexoraBenchmarkToken",
    },
  ].filter((target) => target.address.toLowerCase() !== zeroAddress.toLowerCase());

  return (
    knownTargets.find((target) => target.address.toLowerCase() === address.toLowerCase())?.label ??
    "Custom address"
  );
}

async function readContractOrDefault<T>(read: () => Promise<T>, fallback: T) {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

async function allowAutonomousSelectorOnchain({
  allowed,
  selector,
  target,
  walletAddress,
}: {
  allowed: boolean;
  selector: `0x${string}`;
  target: Address;
  walletAddress?: `0x${string}`;
}) {
  const hash = await writeContract(wagmiConfig, {
    abi: nexora4337AgentWalletAbi,
    address: requireAgentWallet(walletAddress),
    args: [target, selector, allowed],
    chainId: mantleSepolia.id,
    functionName: "setAllowedSelector",
  });

  await waitForMantle(hash, "Allowed selector");
  return hash;
}

export type BenchmarkVaultPermission = {
  address: Address;
  label: string;
  targetAllowed?: boolean;
};

export type AllowedTargetPermission = {
  address: Address;
  allowed: boolean;
  label: string;
};

export type AutonomyOnchainState = {
  allowedTargets: AllowedTargetPermission[];
  benchmarkVaults: BenchmarkVaultPermission[];
  dailyLimitMnt: string;
  enabled: boolean;
  executor: Address;
  maxValuePerActionMnt: string;
  reporterAuthorized: boolean;
  requirePreflight: boolean;
  validUntil: number;
};

export async function readAutonomyStateOnchain({
  agentId,
  executor,
  walletAddress,
}: {
  agentId?: string;
  executor?: `0x${string}`;
  walletAddress?: `0x${string}`;
}): Promise<AutonomyOnchainState | undefined> {
  const address = requireAgentWallet(walletAddress);
  const policy = await readContract(wagmiConfig, {
    abi: nexora4337AgentWalletAbi,
    address,
    chainId: mantleSepolia.id,
    functionName: "executorPolicy",
  });

  const policyExecutor = policy[0] as Address;
  const reporter = executor ?? policyExecutor;
  const reporterAuthorized =
    agentId &&
    reporter.toLowerCase() !== zeroAddress.toLowerCase() &&
    mantleSepoliaContracts.agentValidationRegistry.toLowerCase() !== zeroAddress.toLowerCase()
      ? await readContractOrDefault(
          () =>
            readContract(wagmiConfig, {
              abi: nexoraAgentValidationRegistryAbi,
              address: mantleSepoliaContracts.agentValidationRegistry,
              args: [BigInt(agentId), reporter],
              chainId: mantleSepolia.id,
              functionName: "authorizedReporters",
            }),
          false,
        )
      : false;

  const vaultPermissions = await Promise.all(
    benchmarkVaults.map(async (vault) => {
      const targetAllowed = await readAllowedAddressOnchain({
        target: vault.address,
        walletAddress: address,
      });

      return {
        ...vault,
        targetAllowed,
      };
    }),
  );
  const allowedTargets = await readAllowedTargetsOnchain(address);

  return {
    allowedTargets,
    benchmarkVaults: vaultPermissions,
    dailyLimitMnt: formatEther(policy[4]),
    enabled: policy[1],
    executor: policyExecutor,
    maxValuePerActionMnt: formatEther(policy[3]),
    reporterAuthorized,
    requirePreflight: policy[2],
    validUntil: Number(policy[5]),
  };
}

export async function readAllowedTargetsOnchain(walletAddress?: `0x${string}`) {
  try {
    const [targets, allowedStatuses] = await readContract(wagmiConfig, {
      abi: nexora4337AgentWalletAbi,
      address: requireAgentWallet(walletAddress),
      chainId: mantleSepolia.id,
      functionName: "getAllowedTargets",
    });

    return targets.map((target, index): AllowedTargetPermission => ({
      address: target,
      allowed: Boolean(allowedStatuses[index]),
      label: labelAllowedTarget(target),
    }));
  } catch {
    return [];
  }
}

export async function readAllowedAddressOnchain({
  target,
  walletAddress,
}: {
  target: Address;
  walletAddress?: `0x${string}`;
}) {
  try {
    return await readContract(wagmiConfig, {
      abi: nexora4337AgentWalletAbi,
      address: requireAgentWallet(walletAddress),
      args: [target],
      chainId: mantleSepolia.id,
      functionName: "allowedTargets",
    });
  } catch {
    return undefined;
  }
}

export async function setAllowedAddressOnchain({
  allowed,
  target,
  walletAddress,
}: {
  allowed: boolean;
  target: Address;
  walletAddress?: `0x${string}`;
}) {
  const current = await readAllowedAddressOnchain({ target, walletAddress });
  if (current === allowed) {
    return undefined;
  }

  return allowAutonomousTargetOnchain({ allowed, target, walletAddress });
}

export async function setAllowedSelectorOnchain({
  allowed,
  selector,
  target,
  walletAddress,
}: {
  allowed: boolean;
  selector: `0x${string}`;
  target: Address;
  walletAddress?: `0x${string}`;
}) {
  const current = await readContractOrDefault(
    () =>
      readContract(wagmiConfig, {
        abi: nexora4337AgentWalletAbi,
        address: requireAgentWallet(walletAddress),
        args: [target, selector],
        chainId: mantleSepolia.id,
        functionName: "allowedTargetSelectors",
      }),
    false,
  );

  if (current === allowed) {
    return undefined;
  }

  return allowAutonomousSelectorOnchain({
    allowed,
    selector,
    target,
    walletAddress,
  });
}

export async function saveExecutorPolicyOnchain({
  agentId,
  dailyLimitMnt,
  enabled,
  executor,
  maxValuePerActionMnt,
  validForHours,
  walletAddress,
}: {
  agentId?: string;
  dailyLimitMnt: string;
  enabled: boolean;
  executor: `0x${string}`;
  maxValuePerActionMnt: string;
  validForHours: number;
  walletAddress?: `0x${string}`;
}) {
  const wallet = requireAgentWallet(walletAddress);
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + validForHours * 60 * 60);
  const maxValuePerAction = parseEther(maxValuePerActionMnt);
  const dailyLimit = parseEther(dailyLimitMnt);
  const policy = await readContract(wagmiConfig, {
    abi: nexora4337AgentWalletAbi,
    address: wallet,
    chainId: mantleSepolia.id,
    functionName: "executorPolicy",
  });
  const policyAlreadySet =
    policy[0].toLowerCase() === executor.toLowerCase() &&
    policy[1] === enabled &&
    policy[2] === true &&
    policy[3] === maxValuePerAction &&
    policy[4] === dailyLimit &&
    Number(policy[5]) > Math.floor(Date.now() / 1000);

  let hash: `0x${string}` | undefined;
  if (!policyAlreadySet) {
    hash = await writeContract(wagmiConfig, {
      abi: nexora4337AgentWalletAbi,
      address: wallet,
      args: [
        executor,
        enabled,
        true,
        maxValuePerAction,
        dailyLimit,
        validUntil,
      ],
      chainId: mantleSepolia.id,
      functionName: "setExecutorPolicy",
    });

    await waitForMantle(hash, "Executor policy");
  }

  if (agentId && mantleSepoliaContracts.agentValidationRegistry.toLowerCase() !== zeroAddress.toLowerCase()) {
    const reporterAlreadySet = await readContract(wagmiConfig, {
      abi: nexoraAgentValidationRegistryAbi,
      address: mantleSepoliaContracts.agentValidationRegistry,
      args: [BigInt(agentId), executor],
      chainId: mantleSepolia.id,
      functionName: "authorizedReporters",
    });

    if (reporterAlreadySet !== enabled) {
      const reporterHash = await writeContract(wagmiConfig, {
        abi: nexoraAgentValidationRegistryAbi,
        address: mantleSepoliaContracts.agentValidationRegistry,
        args: [BigInt(agentId), executor, enabled],
        chainId: mantleSepolia.id,
        functionName: "setReporter",
      });

      await waitForMantle(reporterHash, "Validation reporter");
      return reporterHash;
    }

    return hash;
  }

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
    address: requireAgentWallet(walletAddress),
    args: [target, allowed],
    chainId: mantleSepolia.id,
    functionName: "setAllowedTarget",
  });

  await waitForMantle(hash, "Allowed target");
  return hash;
}

export async function allowBenchmarkVaultsOnchain(walletAddress?: `0x${string}`) {
  const address = requireAgentWallet(walletAddress);

  const hashes: `0x${string}`[] = [];
  for (const targetConfig of benchmarkActionTargets) {
    const target = targetConfig.address;
    const targetAllowed = await readContract(wagmiConfig, {
      abi: nexora4337AgentWalletAbi,
      address,
      args: [target],
      chainId: mantleSepolia.id,
      functionName: "allowedTargets",
    });

    if (!targetAllowed) {
      hashes.push(
        await allowAutonomousTargetOnchain({
          allowed: true,
          target,
          walletAddress,
        }),
      );
    }

    for (const { selector } of targetConfig.selectors) {
      const selectorAllowed = await readContract(wagmiConfig, {
        abi: nexora4337AgentWalletAbi,
        address,
        args: [target, selector],
        chainId: mantleSepolia.id,
        functionName: "allowedTargetSelectors",
      });

      if (!selectorAllowed) {
        hashes.push(
          await allowAutonomousSelectorOnchain({
            allowed: true,
            selector,
            target,
            walletAddress,
          }),
        );
      }
    }
  }

  return hashes;
}
