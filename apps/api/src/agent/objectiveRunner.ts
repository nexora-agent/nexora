import type { ObjectiveRun, PolicyProfile } from "@nexora/shared";
import { attachReportEnvelope } from "@nexora/shared";
import { getHarnessTemplate } from "../harness/harnessTemplates";
import { runAgent } from "./agentRunner";
import { scoreBenchmarkRun } from "../harness/scoring/scoreBenchmarkRun";
import { buildObjectivePrompt } from "./promptBuilder";
import { planProposal } from "./proposalPlanner";
import { validateProposalRisk } from "./proposalValidator";

export type ObjectiveRunnerInput = {
  agentId: string;
  agentName?: string;
  harnessId: string;
  objective: string;
  policy: PolicyProfile;
  tokenAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
};

export async function runObjective(input: ObjectiveRunnerInput): Promise<ObjectiveRun> {
  const harness = getHarnessTemplate(input.harnessId);
  const prompt = buildObjectivePrompt(input.objective, harness?.name ?? input.harnessId);
  const result = await runAgent({
    agentId: input.agentId,
    agentName: input.agentName,
    harnessId: input.harnessId,
    policy: input.policy,
    task: input.objective,
    tokenAddress: input.tokenAddress,
    walletAddress: input.walletAddress,
  });
  const proposal = result.intent
    ? planProposal({
        agentId: input.agentId,
        harnessId: input.harnessId,
        intent: result.intent,
        toolTrace: result.toolTrace,
      })
    : undefined;
  const proposalMatchesRisk = proposal
    ? validateProposalRisk(proposal, result.report)
    : false;
  const benchmarkScore = scoreBenchmarkRun({
    proposal,
    report: result.report,
    toolTrace: result.toolTrace,
  });

  return attachReportEnvelope({
    id: `objective-${Date.now()}`,
    agentId: input.agentId,
    harnessId: input.harnessId,
    objective: input.objective,
    status: result.intent && result.report ? "completed" : "failed",
    createdAt: new Date().toISOString(),
    intent: result.intent,
    proposal,
    benchmarkScore,
    riskReport: result.report,
    toolTrace: result.toolTrace,
    summary: result.intent
      ? `${result.intent.summary} Generated inside ${harness?.name ?? input.harnessId}. Proposal risk link ${proposalMatchesRisk ? "verified" : "missing"}.`
      : `Could not produce an intent from prompt: ${prompt}`,
  });
}
