import type { AgentRecord } from "@nexora/shared";
import { calculateReputation } from "@/lib/reputation/calculateReputation";

type AgentLeaderboardProps = {
  agents: AgentRecord[];
};

export function AgentLeaderboard({ agents }: AgentLeaderboardProps) {
  const rankedAgents = [...agents].sort(
    (left, right) =>
      calculateReputation(right.objectiveRuns).trustScore -
      calculateReputation(left.objectiveRuns).trustScore,
  );

  return (
    <section className="agent-leaderboard" aria-label="Smart wallet leaderboard">
      {rankedAgents.map((agent) => (
        <div key={agent.id}>
          <strong>{agent.name}</strong>
          <span>{calculateReputation(agent.objectiveRuns).trustScore}</span>
        </div>
      ))}
    </section>
  );
}
