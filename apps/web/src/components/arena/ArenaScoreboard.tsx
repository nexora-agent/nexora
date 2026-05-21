import type { ArenaRun } from "@nexora/shared";

type ArenaScoreboardProps = {
  arenaRun: ArenaRun;
};

export function ArenaScoreboard({ arenaRun }: ArenaScoreboardProps) {
  return (
    <section className="arena-scoreboard" aria-label="Arena scoreboard">
      <h2>Scoreboard</h2>
      {arenaRun.results.map((result) => (
        <div key={result.agent.id}>
          <strong>
            {result.rank}. {result.agent.name}
          </strong>
          <span>{result.run.benchmarkScore?.finalScore ?? 0}</span>
        </div>
      ))}
    </section>
  );
}
