import type { ObjectiveRun } from "@nexora/shared";

type ObjectiveHistoryProps = {
  runs: ObjectiveRun[];
};

export function ObjectiveHistory({ runs }: ObjectiveHistoryProps) {
  return (
    <section className="objective-history" aria-label="Objective history">
      <h3>Objective History</h3>
      {runs.length === 0 ? (
        <p>No objective runs yet.</p>
      ) : (
        <ol>
          {runs.map((run) => (
            <li key={run.id}>
              <strong>{run.objective}</strong>
              <span>{run.status}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
