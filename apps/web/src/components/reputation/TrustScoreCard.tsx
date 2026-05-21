import type { ReputationStats } from "@nexora/shared";

type TrustScoreCardProps = {
  stats: ReputationStats;
};

export function TrustScoreCard({ stats }: TrustScoreCardProps) {
  return (
    <section className="trust-score-card" aria-label="Trust score">
      <div className="console-topline">
        <span>Trust Score</span>
        <span className="status-pill status-ready">{stats.trustScore}</span>
      </div>
    </section>
  );
}
