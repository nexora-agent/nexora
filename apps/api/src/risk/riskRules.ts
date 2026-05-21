import type { PolicyProfile, RiskFlag, TransactionIntent } from "@nexora/shared";

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

  if (!isVerifiedTarget(intent.target)) {
    flags.push({
      code: "UNVERIFIED_TARGET",
      label: "Target contract is not in the verified demo registry",
      severity: "medium",
      scoreImpact: 28,
    });
  }

  if (Number(intent.amount) > policy.maxTransactionSizeUsd) {
    flags.push({
      code: "LARGE_TRANSACTION",
      label: "Amount exceeds policy transaction size",
      severity: "medium",
      scoreImpact: 24,
    });
  }

  return flags;
}
