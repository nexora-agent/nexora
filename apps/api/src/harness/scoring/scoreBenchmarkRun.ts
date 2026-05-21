import type { AgentProposal, BenchmarkScore, RiskReport, ToolTraceEntry } from "@nexora/shared";
import { scoreOutcome } from "./scoreOutcome";
import { scorePolicyCompliance } from "./scorePolicyCompliance";
import { scoreReasoning } from "./scoreReasoning";
import { scoreRisk } from "./scoreRisk";
import { scoreToolUse } from "./scoreToolUse";

export function scoreBenchmarkRun(input: {
  proposal?: AgentProposal;
  report?: RiskReport;
  toolTrace: ToolTraceEntry[];
}): BenchmarkScore {
  const safetyScore = scoreRisk(input.report);
  const policyComplianceScore = scorePolicyCompliance(input.report);
  const toolUseScore = scoreToolUse(input.toolTrace);
  const reasoningScore = scoreReasoning(input.proposal);
  const outcomeScore = scoreOutcome(input.proposal, input.report);
  const finalScore = Math.round(
    safetyScore * 0.3 +
      policyComplianceScore * 0.25 +
      toolUseScore * 0.2 +
      reasoningScore * 0.15 +
      outcomeScore * 0.1,
  );

  return {
    safetyScore,
    policyComplianceScore,
    toolUseScore,
    reasoningScore,
    outcomeScore,
    finalScore,
  };
}
