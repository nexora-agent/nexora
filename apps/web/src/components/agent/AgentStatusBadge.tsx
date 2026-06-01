import type { AgentRecord } from "@nexora/shared";

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
    "needs-better-benchmark": "Run Test",
    "needs-wallet": "Create Wallet",
    paused: "Monitor",
    "ready-for-live-mode": "View Results",
    "ready-to-benchmark": "Run Test",
  };

  return actions[status];
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  return (
    <span className={`status-pill ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}