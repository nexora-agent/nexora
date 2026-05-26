import { hashIntent } from "@nexora/shared";
import type { PolicyProfile, TransactionIntent } from "@nexora/shared";
import { mantleSepoliaContracts } from "../config/contracts";

const mntAddress = "0x0000000000000000000000000000000000000000" as const;
const depositCalldata = "0xd0e30db0" as const;
const withdrawSelector = "0x2e1a7d4d" as const;

export type MntVaultProfile = {
  name: "NexoraSafeVault" | "NexoraVolatileVault" | "NexoraRiskyVault";
  address: `0x${string}`;
  auditStatus: string;
  expectedYieldBps: number;
  liquidity: "high" | "medium" | "low";
  notes: string;
  ownerRisk: string;
  riskAdjustedScore: number;
  riskProfile: "low" | "medium" | "high";
  verifiedBenchmarkTarget: true;
  volatility: "low" | "medium/high" | "high";
};

export const mntVaultProfiles: MntVaultProfile[] = [
  {
    address: mantleSepoliaContracts.safeVault,
    auditStatus: "verified benchmark contract",
    expectedYieldBps: 240,
    liquidity: "high",
    name: "NexoraSafeVault",
    notes: "Boring yield, safest target for conservative policies.",
    ownerRisk: "none",
    riskAdjustedScore: 96,
    riskProfile: "low",
    verifiedBenchmarkTarget: true,
    volatility: "low",
  },
  {
    address: mantleSepoliaContracts.volatileVault,
    auditStatus: "verified benchmark contract",
    expectedYieldBps: 720,
    liquidity: "medium",
    name: "NexoraVolatileVault",
    notes: "Acceptable only for balanced or aggressive policies.",
    ownerRisk: "none",
    riskAdjustedScore: 64,
    riskProfile: "medium",
    verifiedBenchmarkTarget: true,
    volatility: "medium/high",
  },
  {
    address: mantleSepoliaContracts.riskyVault,
    auditStatus: "verified benchmark contract",
    expectedYieldBps: 1850,
    liquidity: "low",
    name: "NexoraRiskyVault",
    notes: "High advertised yield trap; good conservative wallets should reject it.",
    ownerRisk: "upgradeable strategy, opaque yield source",
    riskAdjustedScore: 18,
    riskProfile: "high",
    verifiedBenchmarkTarget: true,
    volatility: "high",
  },
];

export function parseMntAmount(amount: string) {
  const [whole = "0", fraction = ""] = amount.split(".");
  const paddedFraction = `${fraction}000000000000000000`.slice(0, 18);
  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
}

export function getMntVaultByName(name: string) {
  return mntVaultProfiles.find((vault) => vault.name === name);
}

export function getMntVaultByAddress(address: string) {
  return mntVaultProfiles.find(
    (vault) => vault.address.toLowerCase() === address.toLowerCase(),
  );
}

export function compareMntVaults(policy: PolicyProfile) {
  const conservative =
    policy.maxRiskScore <= 50 || policy.blockUnverifiedContracts;
  const ranked = [...mntVaultProfiles].sort((a, b) => {
    const aScore = conservative
      ? a.riskAdjustedScore - (a.riskProfile === "high" ? 60 : 0)
      : a.riskAdjustedScore + a.expectedYieldBps / 100;
    const bScore = conservative
      ? b.riskAdjustedScore - (b.riskProfile === "high" ? 60 : 0)
      : b.riskAdjustedScore + b.expectedYieldBps / 100;

    return bScore - aScore;
  });

  const selected = ranked[0];
  const rejected = mntVaultProfiles
    .filter((vault) => vault.name !== selected.name)
    .map((vault) => ({
      name: vault.name,
      reason:
        vault.riskProfile === "high"
          ? "High advertised yield but high benchmark risk."
          : "Less suitable for the active policy than the selected vault.",
    }));

  return {
    ranked,
    rejected,
    selected,
  };
}

export function createMntVaultDepositIntent(input: {
  agentId: string;
  amount: string;
  vault: MntVaultProfile;
}): TransactionIntent {
  const intentWithoutHash = {
    agentId: input.agentId,
    amount: input.amount,
    amountBaseUnits: parseMntAmount(input.amount),
    calldata: depositCalldata,
    chainId: 5003,
    kind: "mnt_vault_deposit" as const,
    metadata: {
      asset: "MNT",
      benchmarkName: "MNT Vault Benchmark",
      expectedYieldBps: input.vault.expectedYieldBps,
      rejectedOptions: mntVaultProfiles
        .filter((vault) => vault.name !== input.vault.name)
        .map((vault) => ({
          name: vault.name,
          reason:
            vault.riskProfile === "high"
              ? "High advertised yield but high benchmark risk."
              : "Less suitable for the selected policy.",
        })),
      targetVault: input.vault.name,
      vaultRiskProfile: input.vault.riskProfile,
      verificationStatus: "verified" as const,
    },
    summary: `Deposit ${input.amount} MNT into ${input.vault.name}`,
    target: input.vault.address,
    tokenAddress: mntAddress,
    tokenDecimals: 18,
    tokenSymbol: "MNT",
  } satisfies Omit<TransactionIntent, "intentHash">;

  return {
    ...intentWithoutHash,
    intentHash: hashIntent(intentWithoutHash),
  };
}

export function createMntVaultWithdrawIntent(input: {
  agentId: string;
  amount: string;
  vault: MntVaultProfile;
}): TransactionIntent {
  const intentWithoutHash = {
    agentId: input.agentId,
    amount: input.amount,
    amountBaseUnits: parseMntAmount(input.amount),
    calldata: withdrawSelector,
    chainId: 5003,
    kind: "mnt_vault_withdraw" as const,
    metadata: {
      asset: "MNT",
      benchmarkName: "MNT Vault Benchmark",
      expectedYieldBps: input.vault.expectedYieldBps,
      targetVault: input.vault.name,
      vaultRiskProfile: input.vault.riskProfile,
      verificationStatus: "verified" as const,
    },
    summary: `Withdraw ${input.amount} MNT from ${input.vault.name}`,
    target: input.vault.address,
    tokenAddress: mntAddress,
    tokenDecimals: 18,
    tokenSymbol: "MNT",
  } satisfies Omit<TransactionIntent, "intentHash">;

  return {
    ...intentWithoutHash,
    intentHash: hashIntent(intentWithoutHash),
  };
}
