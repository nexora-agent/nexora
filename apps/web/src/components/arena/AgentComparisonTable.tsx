import type { ArenaRun } from "@nexora/shared";

type AgentComparisonTableProps = {
  arenaRun: ArenaRun;
};

export function AgentComparisonTable({ arenaRun }: AgentComparisonTableProps) {
  return (
    <section className="agent-comparison-table" aria-label="Smart wallet comparison">
      <h2>Smart Wallet Comparison</h2>
      <div className="comparison-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Smart Wallet</th>
              <th>Action</th>
              <th>Risk</th>
              <th>Decision</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {arenaRun.results.map((result) => (
              <tr key={result.agent.id}>
                <td>{result.rank}</td>
                <td>{result.agent.name}</td>
                <td>{result.run.proposal?.actionType ?? "—"}</td>
                <td>{result.run.riskReport?.riskScore ?? "—"}</td>
                <td>{result.run.riskReport?.policyDecision ?? "—"}</td>
                <td>{result.run.benchmarkScore?.finalScore ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
