import type { AgentRecord } from "@nexora/shared";

export type AgentStatus =
  | "draft"
  | "needs-wallet"
  | "needs-funding"
  | "ready-to-benchmark"
  | "benchmark-passed"
  | "live-mode-eligible";

type AgentStatusBadgeProps = {
  status: AgentStatus;
};

const statusLabels: Record<AgentStatus, string> = {
  draft: "Draft",
  "needs-wallet": "Needs wallet",
  "needs-funding": "Needs funding",
  "ready-to-benchmark": "Ready to benchmark",
  "benchmark-passed": "Benchmark passed",
  "live-mode-eligible": "Live mode eligible",
};

const statusClasses: Record<AgentStatus, string> = {
  draft: "status-disconnected",
  "needs-wallet": "status-disconnected",
  "needs-funding": "status-wrong-network",
  "ready-to-benchmark": "status-ready",
  "benchmark-passed": "status-ready",
  "live-mode-eligible": "status-ready",
};

export function getAgentStatus(agent: AgentRecord): AgentStatus {
  if (!agent.walletAddress) {
    return "needs-wallet";
  }

  if (!agent.objectiveRuns?.length) {
    return "needs-funding";
  }

  const score = agent.objectiveRuns[0]?.benchmarkScore?.finalScore ?? 0;
  return score >= 70 ? "benchmark-passed" : "ready-to-benchmark";
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  return (
    <span className={`status-pill ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
