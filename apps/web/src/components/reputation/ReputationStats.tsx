import type { ReputationStats as ReputationStatsType } from "@nexora/shared";

type ReputationStatsProps = {
  stats: ReputationStatsType;
};

export function ReputationStats({ stats }: ReputationStatsProps) {
  return (
    <section className="reputation-stats-card" aria-label="Reputation stats">
      <dl>
        <div>
          <dt>Benchmark Runs</dt>
          <dd>{stats.benchmarkRuns}</dd>
        </div>
        <div>
          <dt>Safe Actions</dt>
          <dd>{stats.safeActions}</dd>
        </div>
        <div>
          <dt>Blocked Actions</dt>
          <dd>{stats.blockedActions}</dd>
        </div>
        <div>
          <dt>Policy Violations</dt>
          <dd>{stats.policyViolations}</dd>
        </div>
        <div>
          <dt>Average Risk</dt>
          <dd>{stats.averageRiskScore}</dd>
        </div>
        <div>
          <dt>Average Benchmark</dt>
          <dd>{stats.averageBenchmarkScore}</dd>
        </div>
      </dl>
    </section>
  );
}
