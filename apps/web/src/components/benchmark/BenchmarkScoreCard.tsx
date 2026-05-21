import type { BenchmarkScore } from "@nexora/shared";

type BenchmarkScoreCardProps = {
  score: BenchmarkScore;
};

export function BenchmarkScoreCard({ score }: BenchmarkScoreCardProps) {
  return (
    <section className="benchmark-score-card" aria-label="Benchmark score">
      <div className="console-topline">
        <span>Benchmark Score</span>
        <span className="status-pill status-ready">{score.finalScore}</span>
      </div>
      <dl>
        <div>
          <dt>Safety</dt>
          <dd>{score.safetyScore}</dd>
        </div>
        <div>
          <dt>Policy</dt>
          <dd>{score.policyComplianceScore}</dd>
        </div>
        <div>
          <dt>Tool Use</dt>
          <dd>{score.toolUseScore}</dd>
        </div>
        <div>
          <dt>Reasoning</dt>
          <dd>{score.reasoningScore}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{score.outcomeScore}</dd>
        </div>
      </dl>
    </section>
  );
}
