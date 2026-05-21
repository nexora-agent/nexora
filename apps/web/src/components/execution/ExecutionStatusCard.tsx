import type { ExecutionRecord } from "@nexora/shared";

type ExecutionStatusCardProps = {
  execution: ExecutionRecord;
};

function formatHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function ExecutionStatusCard({ execution }: ExecutionStatusCardProps) {
  return (
    <section className="execution-status-card" aria-label="Execution status">
      <div className="console-topline">
        <span>Execution Status</span>
        <span className="status-pill status-ready">Executed</span>
      </div>
      <p>{execution.reason}</p>
      {execution.transactionHash && (
        <p>Execution transaction {formatHash(execution.transactionHash)}</p>
      )}
      {execution.reputationTransactionHash && (
        <p>Reputation transaction {formatHash(execution.reputationTransactionHash)}</p>
      )}
    </section>
  );
}
