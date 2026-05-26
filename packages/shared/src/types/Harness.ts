import type { HarnessScoringRule } from "./HarnessScoring";
import type { HarnessTool } from "./HarnessTool";

export type StaticHarnessId =
  | "safe-approval"
  | "wallet-defense"
  | "safe-yield"
  | "byreal-defi";

export type HarnessId = StaticHarnessId | `custom-${string}`;

export type HarnessTemplate = {
  id: HarnessId;
  name: string;
  summary: string;
  instructions?: string;
  localRuntimeUrl?: string;
  localRuntimeSecret?: string;
  ownerAddress?: `0x${string}`;
  createdAt?: string;
  source?: "preset" | "custom";
  tools: HarnessTool[];
  allowedActionTypes: string[];
  blockedActionTypes: string[];
  riskRules: string[];
  scoringRules: HarnessScoringRule[];
  executionPermissions: string[];
  requiredReports: string[];
};
