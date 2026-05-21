import type { ArenaRun } from "@nexora/shared";

type ArenaResultSummaryProps = {
  arenaRun: ArenaRun;
};

export function ArenaResultSummary({ arenaRun }: ArenaResultSummaryProps) {
  const winner = arenaRun.winner;

  if (!winner) {
    return null;
  }

  return (
    <section className="arena-result-summary" aria-label="Arena result summary">
      <div className="console-topline">
        <span>Winner</span>
        <span className="status-pill status-ready">{winner.agent.name}</span>
      </div>
      <h2>{winner.agent.name}</h2>
      <p>{winner.winnerReason}</p>
      <dl className="agent-card-grid">
        <div>
          <dt>Harness</dt>
          <dd>{arenaRun.harnessId}</dd>
        </div>
        <div>
          <dt>Objective</dt>
          <dd>{arenaRun.objective}</dd>
        </div>
      </dl>
    </section>
  );
}
