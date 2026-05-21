import type { AgentRecord } from "./Agent";
import type { HarnessId } from "./Harness";
import type { ObjectiveRun } from "./ObjectiveRun";

export type ArenaAgentResult = {
  agent: AgentRecord;
  run: ObjectiveRun;
  rank: number;
  winnerReason: string;
};

export type ArenaRun = {
  id: string;
  harnessId: HarnessId;
  objective: string;
  createdAt: string;
  results: ArenaAgentResult[];
  winner?: ArenaAgentResult;
};
