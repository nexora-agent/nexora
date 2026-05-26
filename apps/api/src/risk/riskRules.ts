import type { PolicyProfile, RiskFlag, TransactionIntent } from "@nexora/shared";
import { getMntVaultByAddress } from "../benchmark/mntVaults";

const maxUint256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const verifiedContracts = new Set([
  "0x0000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000004",
]);

function isUnlimitedApproval(intent: TransactionIntent) {
  return (
    intent.kind === "erc20_approval" &&
    (intent.amount.toLowerCase() === "unlimited" ||
      intent.amountBaseUnits === maxUint256)
  );
}

function isVerifiedTarget(target: string) {
  return verifiedContracts.has(target.toLowerCase());
}

function isByrealPreview(intent: TransactionIntent) {
  return intent.kind.startsWith("byreal_");
}

function isMntVaultIntent(intent: TransactionIntent) {
  return (
    intent.kind === "mnt_vault_deposit" || intent.kind === "mnt_vault_withdraw"
  );
}

export function evaluateRiskRules(
  intent: TransactionIntent,
  policy: PolicyProfile,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (intent.kind === "erc20_transfer") {
    flags.push({
      code: "TRANSFER",
      label: "ERC-20 transfer",
      severity: "low",
      scoreImpact: 10,
    });
  }

  if (intent.kind === "erc20_approval") {
    flags.push({
      code: "APPROVAL",
      label: "ERC-20 approval",
      severity: "medium",
      scoreImpact: 20,
    });
  }

  if (isMntVaultIntent(intent)) {
    const vault = getMntVaultByAddress(intent.target);

    flags.push({
      code:
        intent.kind === "mnt_vault_deposit"
          ? "MNT_VAULT_DEPOSIT"
          : "MNT_VAULT_WITHDRAW",
      label:
        intent.kind === "mnt_vault_deposit"
          ? "MNT vault deposit"
          : "MNT vault withdraw",
      severity: "low",
      scoreImpact: 6,
    });

    if (!vault) {
      flags.push({
        code: "UNKNOWN_PAYABLE_TARGET",
        label: "Unknown payable target",
        severity: "high",
        scoreImpact: 60,
      });
    } else {
      flags.push({
        code: "VERIFIED_BENCHMARK_VAULT",
        label: "Verified Nexora benchmark vault",
        severity: "low",
        scoreImpact: 0,
      });

      if (vault.riskProfile === "medium") {
        flags.push({
          code: "VOLATILE_BENCHMARK_VAULT",
          label: "Volatile benchmark vault",
          severity: "medium",
          scoreImpact: 32,
        });
      }

      if (vault.riskProfile === "high") {
        flags.push({
          code: "RISKY_BENCHMARK_VAULT",
          label: "Risky benchmark vault",
          severity: "high",
          scoreImpact: 76,
        });
      }
    }
  }

  if (isByrealPreview(intent)) {
    flags.push(
      {
        code: "EXTERNAL_DEFI_TARGET",
        label: "External DeFi target",
        severity: "medium",
        scoreImpact: 12,
      },
      {
        code: "BOUNDED_ACTION",
        label: "Bounded action amount",
        severity: "low",
        scoreImpact: 0,
      },
      {
        code: "DRY_RUN_ONLY",
        label: "Dry-run only",
        severity: "low",
        scoreImpact: 0,
      },
      {
        code: "LIVE_EXECUTION_DISABLED",
        label: "Live execution disabled",
        severity: "low",
        scoreImpact: 0,
      },
    );

    if (intent.metadata?.expectedYield === "high") {
      flags.push({
        code: "HIGH_APR_WARNING",
        label: "High APR requires extra review",
        severity: "medium",
        scoreImpact: 22,
      });
    }

    if (intent.metadata?.riskHints?.some((hint) => hint.includes("low TVL"))) {
      flags.push({
        code: "LOW_TVL_WARNING",
        label: "Low TVL opportunity",
        severity: "medium",
        scoreImpact: 18,
      });
    }

    if (intent.metadata?.riskHints?.some((hint) => hint.includes("volatility"))) {
      flags.push({
        code: "HIGH_VOLATILITY_WARNING",
        label: "High volatility opportunity",
        severity: "medium",
        scoreImpact: 22,
      });
    }
  }

  if (isUnlimitedApproval(intent)) {
    flags.push({
      code: "UNLIMITED_APPROVAL",
      label: "Unlimited approval detected",
      severity: "high",
      scoreImpact: 65,
    });
  } else if (intent.kind === "erc20_approval") {
    flags.push({
      code: "LIMITED_APPROVAL",
      label: "Limited approval amount",
      severity: "low",
      scoreImpact: 8,
    });
  }

  if (
    !isByrealPreview(intent) &&
    !isMntVaultIntent(intent) &&
    !isVerifiedTarget(intent.target)
  ) {
    flags.push({
      code: "UNVERIFIED_TARGET",
      label: "Target contract is not in the verified demo registry",
      severity: "medium",
      scoreImpact: 28,
    });
  }

  if (Number(intent.amount) > policy.maxTransactionSizeUsd) {
    flags.push({
      code: isMntVaultIntent(intent) ? "AMOUNT_EXCEEDS_POLICY" : "LARGE_TRANSACTION",
      label: isMntVaultIntent(intent)
        ? "MNT amount exceeds policy"
        : "Amount exceeds policy transaction size",
      severity: "medium",
      scoreImpact: 24,
    });
  }

  return flags;
}
