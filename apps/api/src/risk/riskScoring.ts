import type { RiskFlag } from "@nexora/shared";

export function scoreRisk(flags: RiskFlag[]) {
  return Math.min(
    100,
    flags.reduce((score, flag) => score + flag.scoreImpact, 0),
  );
}
