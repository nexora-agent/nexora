import type {
  AgentRecord,
  ArenaAgentResult,
  ArenaRun,
  HarnessId,
} from "@nexora/shared";
import { runObjectiveLocally } from "@/lib/objectives/runObjectiveLocally";

function reasonForRank(result: ArenaAgentResult) {
  const decision = result.run.riskReport?.policyDecision ?? "unknown";
  const riskScore = result.run.riskReport?.riskScore ?? 100;
  const benchmarkScore = result.run.benchmarkScore?.finalScore ?? 0;

  if (decision === "blocked") {
    return `Blocked by policy with risk ${riskScore}.`;
  }

  return `Passed policy with benchmark ${benchmarkScore} and risk ${riskScore}.`;
}

function scoreResult(result: ArenaAgentResult) {
  const benchmarkScore = result.run.benchmarkScore?.finalScore ?? 0;
  const riskScore = result.run.riskReport?.riskScore ?? 100;
  const policyBonus = result.run.riskReport?.policyDecision === "passed" ? 100 : 0;

  return policyBonus + benchmarkScore - riskScore;
}

export function runArenaLocally(input: {
  agents: AgentRecord[];
  harnessId: HarnessId;
  objective: string;
}): ArenaRun {
  const rawResults = input.agents.map((agent) => {
    const arenaAgent: AgentRecord = {
      ...agent,
      selectedHarnessId: input.harnessId,
      metadata: {
        ...agent.metadata,
        selectedHarnessId: input.harnessId,
      },
    };
    const run = runObjectiveLocally(arenaAgent, input.objective);

    return {
      agent: arenaAgent,
      run,
      rank: 0,
      winnerReason: "",
    };
  });

  const rankedResults = rawResults
    .sort((left, right) => scoreResult(right) - scoreResult(left))
    .map((result, index) => ({
      ...result,
      rank: index + 1,
      winnerReason: reasonForRank(result),
    }));

  return {
    id: `arena-${Date.now()}`,
    harnessId: input.harnessId,
    objective: input.objective,
    createdAt: new Date().toISOString(),
    results: rankedResults,
    winner: rankedResults[0],
  };
}
