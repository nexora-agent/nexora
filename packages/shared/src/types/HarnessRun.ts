import type { BenchmarkScore } from "./BenchmarkScore";
import type { ObjectiveRun } from "./ObjectiveRun";

export type HarnessRun = ObjectiveRun & {
  benchmarkScore?: BenchmarkScore;
};
