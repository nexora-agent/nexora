import type { ExecutionRecord } from "@nexora/shared";

type BlockedExecutionCardProps = {
  execution: ExecutionRecord;
};

function formatHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function BlockedExecutionCard({ execution }: BlockedExecutionCardProps) {
  return (
    <section className="blocked-execution-card" aria-label="Blocked execution">
      <div className="console-topline">
        <span>Execution Status</span>
        <span className="status-pill risk-high">Blocked</span>
      </div>
      <p>{execution.reason}</p>
      {execution.reputationTransactionHash && (
        <p>Reputation transaction {formatHash(execution.reputationTransactionHash)}</p>
      )}
    </section>
  );
}
