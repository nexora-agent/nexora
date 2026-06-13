import type { AgentRecord } from "@nexora/shared";
import type {
  SmartWalletMissingRequirement,
  SmartWalletReadiness,
} from "@/hooks/useSmartWalletReadiness";

export const MINIMUM_MNT_READY_BALANCE = 0.02;

export type AgentStatus =
  | "draft"
  | "needs-wallet"
  | "needs-funding"
  | "ready-to-benchmark"
  | "benchmark-complete"
  | "needs-better-benchmark"
  | "ready-for-live-mode"
  | "active"
  | "paused";

type AgentStatusBadgeProps = {
  status: AgentStatus;
};

export type AgentFundingStatusInput = {
  balanceMnt: number | null;
  minimumReadyBalanceMnt?: number;
};

export type AgentActionKind =
  | "create-wallet"
  | "fund-wallet"
  | "view-results"
  | "monitor";

export type AgentAvailableAction = {
  kind: AgentActionKind;
  label: string;
  primary?: boolean;
};

const statusLabels: Record<AgentStatus, string> = {
  draft: "Draft",
  "needs-wallet": "Needs wallet",
  "needs-funding": "Needs funding",
  "ready-to-benchmark": "Ready to benchmark",
  "benchmark-complete": "Benchmark complete",
  "needs-better-benchmark": "Needs better benchmark",
  "ready-for-live-mode": "Ready for live mode",
  active: "Active",
  paused: "Paused",
};

const statusClasses: Record<AgentStatus, string> = {
  draft: "status-disconnected",
  "needs-wallet": "status-disconnected",
  "needs-funding": "status-wrong-network",
  "ready-to-benchmark": "status-ready",
  "benchmark-complete": "status-ready",
  "needs-better-benchmark": "status-wrong-network",
  "ready-for-live-mode": "status-ready",
  active: "status-ready",
  paused: "status-disconnected",
};

function isFundingStatusInput(
  value: boolean | AgentFundingStatusInput | undefined,
): value is AgentFundingStatusInput {
  return typeof value === "object" && value !== null && "balanceMnt" in value;
}

function hasMinimumRequiredBalance(
  fundingStatus: boolean | AgentFundingStatusInput | undefined,
): boolean {
  if (isFundingStatusInput(fundingStatus)) {
    const minimumReadyBalanceMnt =
      fundingStatus.minimumReadyBalanceMnt ?? MINIMUM_MNT_READY_BALANCE;

    return (
      fundingStatus.balanceMnt !== null &&
      Number.isFinite(fundingStatus.balanceMnt) &&
      fundingStatus.balanceMnt >= minimumReadyBalanceMnt
    );
  }

  if (typeof fundingStatus === "boolean") {
    return fundingStatus;
  }

  return false;
}

export function getAgentStatus(
  agent: AgentRecord,
  fundingStatus?: boolean | AgentFundingStatusInput,
): AgentStatus {
  if (!agent.walletAddress) {
    return "needs-wallet";
  }

  const isFunded = hasMinimumRequiredBalance(fundingStatus);

  if (!isFunded) {
    return "needs-funding";
  }

  if (!agent.objectiveRuns?.length) {
    return "ready-to-benchmark";
  }

  const score = agent.objectiveRuns[0]?.benchmarkScore?.finalScore ?? 0;

  if (score < 70) {
    return "needs-better-benchmark";
  }

  return score >= 80 ? "ready-for-live-mode" : "benchmark-complete";
}

export function getAgentNextAction(status: AgentStatus) {
  const actions: Record<AgentStatus, string> = {
    active: "Monitor",
    "benchmark-complete": "View Results",
    draft: "Create Wallet",
    "needs-funding": "Fund Wallet",
    "needs-better-benchmark": "Fund Wallet",
    "needs-wallet": "Create Wallet",
    paused: "Monitor",
    "ready-for-live-mode": "View Results",
    "ready-to-benchmark": "Fund Wallet",
  };

  return actions[status];
}

export function getAgentAvailableActions(
  agent: AgentRecord,
  status: AgentStatus,
): AgentAvailableAction[] {
  const primaryByStatus: Partial<Record<AgentStatus, AgentAvailableAction>> = {
    active: {
      kind: "monitor",
      label: "Monitor",
      primary: true,
    },
    "benchmark-complete": {
      kind: "view-results",
      label: "View Results",
      primary: true,
    },
    draft: {
      kind: "create-wallet",
      label: "Create Wallet",
      primary: true,
    },
    "needs-funding": {
      kind: "fund-wallet",
      label: "Fund Wallet",
      primary: true,
    },
    "needs-wallet": {
      kind: "create-wallet",
      label: "Create Wallet",
      primary: true,
    },
    paused: {
      kind: "monitor",
      label: "Monitor",
      primary: true,
    },
    "ready-for-live-mode": {
      kind: "view-results",
      label: "View Results",
      primary: true,
    },
  };

  const primaryAction = primaryByStatus[status];
  const actions: AgentAvailableAction[] = primaryAction ? [primaryAction] : [];

  if (
    agent.walletAddress &&
    !actions.some((action) => action.kind === "fund-wallet")
  ) {
    actions.push({
      kind: "fund-wallet",
      label: "Fund Wallet",
      primary: actions.length === 0,
    });
  }

  return actions;
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  return (
    <span className={`status-pill ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

// --- Smart wallet readiness (loading-aware status model) ---

const missingRequirementLabels: Record<SmartWalletMissingRequirement, string> = {
  benchmark: "benchmark",
  executor: "executor link",
  funding: "funding",
};

const singleMissingLabels: Record<SmartWalletMissingRequirement, string> = {
  benchmark: "Benchmark missing",
  executor: "Executor link missing",
  funding: "Needs funding",
};

export function getReadinessLabel(readiness: SmartWalletReadiness): string {
  if (readiness.status === "loading") {
    return "Loading";
  }

  if (readiness.status === "wallet-missing") {
    return "Wallet missing";
  }

  if (readiness.status === "executor-expired") {
    return "Executor expired";
  }

  if (readiness.status === "setup-missing") {
    return readiness.missing.length === 1
      ? singleMissingLabels[readiness.missing[0]]
      : "Setup incomplete";
  }

  return "Ready to use";
}

export function getReadinessTitle(readiness: SmartWalletReadiness): string | undefined {
  if (readiness.status === "setup-missing" && readiness.missing.length > 1) {
    const order: SmartWalletMissingRequirement[] = ["funding", "benchmark", "executor"];
    const parts = order
      .filter((item) => readiness.missing.includes(item))
      .map((item) => missingRequirementLabels[item]);
    return `Missing: ${parts.join(", ")}`;
  }

  return undefined;
}

export type ReadinessActionKind =
  | "create-wallet"
  | "select-benchmark"
  | "link-executor"
  | "fund-wallet"
  | "open-setup"
  | "renew-executor"
  | "open-wallet";

export function getReadinessAction(
  readiness: SmartWalletReadiness,
): { kind: ReadinessActionKind; label: string } | undefined {
  if (readiness.status === "loading") {
    return undefined;
  }

  if (readiness.status === "wallet-missing") {
    return { kind: "create-wallet", label: "Create Wallet" };
  }

  if (readiness.status === "executor-expired") {
    return { kind: "renew-executor", label: "Renew Executor" };
  }

  if (readiness.status === "setup-missing") {
    if (readiness.missing.length > 1) {
      return { kind: "open-setup", label: "Open Setup" };
    }

    const actionsByMissing: Record<
      SmartWalletMissingRequirement,
      { kind: ReadinessActionKind; label: string }
    > = {
      benchmark: { kind: "select-benchmark", label: "Select Benchmark" },
      executor: { kind: "link-executor", label: "Link Executor" },
      funding: { kind: "fund-wallet", label: "Fund Wallet" },
    };

    return actionsByMissing[readiness.missing[0]];
  }

  return { kind: "open-wallet", label: "Use Wallet" };
}

const readinessClasses: Record<SmartWalletReadiness["status"], string> = {
  "executor-expired": "status-wrong-network",
  loading: "status-pill-skeleton",
  ready: "status-ready",
  "setup-missing": "status-wrong-network",
  "wallet-missing": "status-disconnected",
};

export function SmartWalletReadinessBadge({
  readiness,
}: {
  readiness: SmartWalletReadiness;
}) {
  if (readiness.status === "loading") {
    return (
      <span
        aria-label="Loading wallet status"
        className="status-pill status-pill-skeleton"
      />
    );
  }

  return (
    <span
      className={`status-pill ${readinessClasses[readiness.status]}`}
      title={getReadinessTitle(readiness)}
    >
      {getReadinessLabel(readiness)}
    </span>
  );
}
