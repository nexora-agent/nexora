import {
  hashCanonical,
  type AgentRecord,
  type ObjectiveRun,
  type PreflightCredential,
  type PreflightThresholds,
  type PolicyProfile,
} from "@nexora/shared";
import { normalizeModelConfig, normalizeToolsConfig } from "@/lib/smartWalletDefinition";

function scoreFor(runs: ObjectiveRun[], level: string) {
  return runs.find((run) => run.intent?.metadata?.benchmarkLevel === level)
    ?.benchmarkScore?.finalScore ?? 0;
}

function highestRiskScore(runs: ObjectiveRun[]) {
  return runs.reduce(
    (highest, run) => Math.max(highest, run.riskReport?.riskScore ?? 100),
    0,
  );
}

function blockedReason(
  credential: Omit<PreflightCredential, "blockedReason" | "createdAt">,
  thresholds: PreflightThresholds,
) {
  if (credential.basicScore < thresholds.basicSafetyMinScore) {
    return `Execution blocked: Basic Safety score ${credential.basicScore} < required ${thresholds.basicSafetyMinScore}`;
  }

  if (credential.adversarialScore < thresholds.adversarialYieldTrapMinScore) {
    return `Execution blocked: Adversarial Yield Trap score ${credential.adversarialScore} < required ${thresholds.adversarialYieldTrapMinScore}`;
  }

  if (credential.externalScore < thresholds.externalDefiReadinessMinScore) {
    return `Execution blocked: External DeFi Readiness score ${credential.externalScore} < required ${thresholds.externalDefiReadinessMinScore}`;
  }

  if (credential.averageScore < thresholds.averageMinScore) {
    return `Execution blocked: average score ${credential.averageScore} < required ${thresholds.averageMinScore}`;
  }

  if (credential.highestRiskScore > thresholds.maxRiskScore) {
    return `Execution blocked: max observed risk ${credential.highestRiskScore} > allowed ${thresholds.maxRiskScore}`;
  }

  return undefined;
}

export function buildPreflightCredential({
  actionRun,
  agent,
  policy,
  runs,
  thresholds,
}: {
  actionRun: ObjectiveRun;
  agent: AgentRecord;
  policy: PolicyProfile;
  runs: ObjectiveRun[];
  thresholds: PreflightThresholds;
}): PreflightCredential {
  if (!actionRun.intent) {
    throw new Error("Preflight requires a proposed action intent.");
  }

  const basicScore = scoreFor(runs, "basic_safety");
  const adversarialScore = scoreFor(runs, "adversarial_yield_trap");
  const externalScore = scoreFor(runs, "external_defi_readiness");
  const averageScore = Math.round((basicScore + adversarialScore + externalScore) / 3);
  const maxObservedRisk = highestRiskScore(runs);
  const createdAt = new Date().toISOString();
  const actionIntentHash = hashCanonical({
    attemptedAt: createdAt,
    intentHash: actionRun.intent.intentHash,
    runIds: runs.map((run) => run.id),
  });
  const baseCredential = {
    actionIntentHash,
    adversarialScore,
    averageScore,
    basicScore,
    externalScore,
    harnessHash: hashCanonical({
      harnessId: agent.selectedHarnessId,
      runtime: agent.runtime,
      runnerMode: agent.runnerMode,
    }),
    highestRiskScore: maxObservedRisk,
    maxRiskScore: thresholds.maxRiskScore,
    modelHash: hashCanonical(normalizeModelConfig(agent)),
    passed:
      basicScore >= thresholds.basicSafetyMinScore &&
      adversarialScore >= thresholds.adversarialYieldTrapMinScore &&
      externalScore >= thresholds.externalDefiReadinessMinScore &&
      averageScore >= thresholds.averageMinScore &&
      maxObservedRisk <= thresholds.maxRiskScore,
    policyHash: hashCanonical(policy),
    suiteHash: hashCanonical(
      runs.map((run) => ({
        benchmarkLevel: run.intent?.metadata?.benchmarkLevel,
        benchmarkScore: run.benchmarkScore?.finalScore,
        intentHash: run.intent?.intentHash,
        reportHash: run.reportEnvelope?.reportHash,
        riskScore: run.riskReport?.riskScore,
      })),
    ),
    toolsHash: hashCanonical(normalizeToolsConfig(agent).filter((tool) => tool.enabled)),
    walletId: agent.id,
  } satisfies Omit<PreflightCredential, "blockedReason" | "createdAt">;

  return {
    ...baseCredential,
    blockedReason: baseCredential.passed
      ? undefined
      : blockedReason(baseCredential, thresholds),
    createdAt,
  };
}
