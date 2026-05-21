import type { ObjectiveRun } from "@nexora/shared";

type ReputationEventTableProps = {
  runs: ObjectiveRun[];
};

export function ReputationEventTable({ runs }: ReputationEventTableProps) {
  return (
    <section className="reputation-event-table" aria-label="Reputation events">
      <h3>Reputation Events</h3>
      {runs.length === 0 ? (
        <p>No reputation events yet.</p>
      ) : (
        <ol>
          {runs.map((run) => (
            <li key={run.id}>
              <strong>{run.objective}</strong>
              <span>{run.execution?.status ?? "pending"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
