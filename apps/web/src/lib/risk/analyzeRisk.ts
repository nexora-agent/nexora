"use client";

import type {
  PolicyDecision,
  PolicyProfile,
  RiskFlag,
  RiskLevel,
  RiskReport,
  TransactionIntent,
} from "@nexora/shared";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";

const verifiedTargets = new Set([
  "0x0000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000004",
]);

function isByrealIntent(intent: TransactionIntent) {
  return intent.kind.startsWith("byreal_");
}

const maxUint256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

function riskLevel(score: number): RiskLevel {
  if (score >= 80) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function flagsForIntent(
  intent: TransactionIntent,
  policy: PolicyProfile,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (intent.kind === "erc20_transfer") {
    flags.push({
      code: "TRANSFER",
      label: "ERC-20 transfer",
      scoreImpact: 10,
      severity: "low",
    });
  }

  if (intent.kind === "mnt_vault_deposit" || intent.kind === "mnt_vault_withdraw") {
    flags.push({
      code: intent.kind === "mnt_vault_deposit" ? "MNT_VAULT_DEPOSIT" : "MNT_VAULT_WITHDRAW",
      label: intent.kind === "mnt_vault_deposit" ? "MNT vault deposit" : "MNT vault withdraw",
      scoreImpact: 6,
      severity: "low",
    });

    const vault = benchmarkVaults.get(intent.target.toLowerCase());
    if (!vault) {
      flags.push({
        code: "UNKNOWN_PAYABLE_TARGET",
        label: "Unknown payable target",
        scoreImpact: 60,
        severity: "high",
      });
    } else {
      flags.push({
        code: "VERIFIED_BENCHMARK_VAULT",
        label: "Verified Nexora benchmark vault",
        scoreImpact: 0,
        severity: "low",
      });

      if (vault.risk === "medium") {
        flags.push({
          code: "VOLATILE_BENCHMARK_VAULT",
          label: "Volatile benchmark vault",
          scoreImpact: 32,
          severity: "medium",
        });
      }

      if (vault.risk === "high") {
        flags.push({
          code: "RISKY_BENCHMARK_VAULT",
          label: "Risky benchmark vault",
          scoreImpact: 76,
          severity: "high",
        });
      }
    }
  }

  if (intent.kind === "erc20_approval") {
    flags.push({
      code: "APPROVAL",
      label: "ERC-20 approval",
      scoreImpact: 20,
      severity: "medium",
    });

    if (
      intent.amount.toLowerCase() === "unlimited" ||
      intent.amountBaseUnits === maxUint256
    ) {
      flags.push({
        code: "UNLIMITED_APPROVAL",
        label: "Unlimited approval detected",
        scoreImpact: 65,
        severity: "high",
      });
    } else {
      flags.push({
        code: "LIMITED_APPROVAL",
        label: "Limited approval amount",
        scoreImpact: 8,
        severity: "low",
      });
    }
  }

  if (isByrealIntent(intent)) {
    flags.push(
      {
        code: "EXTERNAL_DEFI_TARGET",
        label: "External DeFi target",
        scoreImpact: 12,
        severity: "medium",
      },
      {
        code: "BOUNDED_ACTION",
        label: "Bounded action amount",
        scoreImpact: 0,
        severity: "low",
      },
      {
        code: "DRY_RUN_ONLY",
        label: "Dry-run only",
        scoreImpact: 0,
        severity: "low",
      },
      {
        code: "LIVE_EXECUTION_DISABLED",
        label: "Live execution disabled",
        scoreImpact: 0,
        severity: "low",
      },
    );

    if (intent.metadata?.expectedYield === "high") {
      flags.push({
        code: "HIGH_APR_WARNING",
        label: "High APR requires extra review",
        scoreImpact: 22,
        severity: "medium",
      });
    }

    if (intent.metadata?.riskHints?.some((hint) => hint.includes("low TVL"))) {
      flags.push({
        code: "LOW_TVL_WARNING",
        label: "Low TVL opportunity",
        scoreImpact: 18,
        severity: "medium",
      });
    }

    if (intent.metadata?.riskHints?.some((hint) => hint.includes("volatility"))) {
      flags.push({
        code: "HIGH_VOLATILITY_WARNING",
        label: "High volatility opportunity",
        scoreImpact: 22,
        severity: "medium",
      });
    }
  }

  if (
    intent.kind !== "mnt_vault_deposit" &&
    intent.kind !== "mnt_vault_withdraw" &&
    !isByrealIntent(intent) &&
    !verifiedTargets.has(intent.target.toLowerCase())
  ) {
    flags.push({
      code: "UNVERIFIED_TARGET",
      label: "Target contract is not in the verified registry",
      scoreImpact: 28,
      severity: "medium",
    });
  }

  if (Number(intent.amount) > policy.maxTransactionSizeUsd) {
    flags.push({
      code: intent.tokenSymbol === "MNT" ? "AMOUNT_EXCEEDS_POLICY" : "LARGE_TRANSACTION",
      label: "Amount exceeds policy transaction size",
      scoreImpact: 24,
      severity: "medium",
    });
  }

  return flags;
}

export function analyzeRiskLocally(
  intent: TransactionIntent,
  policy: PolicyProfile,
  walletAddress?: `0x${string}`,
): RiskReport {
  const flags = flagsForIntent(intent, policy);
  const riskScore = Math.min(
    100,
    flags.reduce((score, flag) => score + flag.scoreImpact, 0),
  );
  const policyDecision: PolicyDecision =
    riskScore <= policy.maxRiskScore &&
    !(
      policy.blockUnlimitedApprovals &&
      flags.some((flag) => flag.code === "UNLIMITED_APPROVAL")
    ) &&
    !(
      policy.blockUnverifiedContracts &&
      flags.some((flag) => flag.code === "UNVERIFIED_TARGET")
    )
      ? "passed"
      : "blocked";

  const majorFlags = flags
    .filter((flag) => flag.severity !== "low")
    .map((flag) => flag.label);

  return {
    agentId: intent.agentId,
    explanation: {
      recommendation:
        policyDecision === "passed"
          ? "Proceed only after confirming the target address and amount."
          : "Do not execute this action unless the policy or transaction is changed.",
      reasoning:
        majorFlags.length > 0
          ? majorFlags
          : ["No high-severity deterministic risk flags were found."],
      summary:
        policyDecision === "passed"
          ? `Risk score ${riskScore}/100. The action passes the active policy.`
          : `Risk score ${riskScore}/100. The action is blocked by the active policy.`,
    },
    flags,
    intent,
    intentHash: intent.intentHash,
    policy,
    policyDecision,
    riskLevel: riskLevel(riskScore),
    riskScore,
    walletAddress,
  };
}
const benchmarkVaults = new Map<string, { name: string; risk: "low" | "medium" | "high" }>([
  [mantleSepoliaContracts.safeVault.toLowerCase(), { name: "NexoraSafeVault", risk: "low" }],
  [mantleSepoliaContracts.volatileVault.toLowerCase(), { name: "NexoraVolatileVault", risk: "medium" }],
  [mantleSepoliaContracts.riskyVault.toLowerCase(), { name: "NexoraRiskyVault", risk: "high" }],
]);
