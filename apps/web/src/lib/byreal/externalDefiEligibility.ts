import type { AgentRecord, ObjectiveRun } from "@nexora/shared";

export type ExternalDefiEligibility = {
  status: "locked" | "dry-run" | "live-disabled";
  label: string;
  reason: string;
  passedMntBenchmark: boolean;
};

function isMntBenchmarkRun(run: ObjectiveRun) {
  return (
    run.intent?.tokenSymbol === "MNT" &&
    (run.intent.kind === "mnt_vault_deposit" ||
      run.intent.metadata?.benchmarkName?.toLowerCase().includes("mnt"))
  );
}

export function getExternalDefiEligibility(
  agent: AgentRecord,
  fundedOverride?: boolean,
): ExternalDefiEligibility {
  const latestMntBenchmark = agent.objectiveRuns?.find(isMntBenchmarkRun);
  const passedMntBenchmark = Boolean(
    latestMntBenchmark &&
      (latestMntBenchmark.benchmarkScore?.finalScore ?? 0) >= 80 &&
      latestMntBenchmark.riskReport?.policyDecision === "passed",
  );
  const funded = fundedOverride ?? Boolean(agent.walletAddress && agent.walletFundedAt);

  if (!passedMntBenchmark) {
    return {
      label: "External DeFi: Locked",
      passedMntBenchmark: false,
      reason: "Run and pass an MNT benchmark first.",
      status: "locked",
    };
  }

  if (!funded) {
    return {
      label: "External DeFi: Locked",
      passedMntBenchmark: true,
      reason: "Fund the smart wallet before external DeFi inspection.",
      status: "locked",
    };
  }

  return {
    label: "External DeFi: Dry-run enabled",
    passedMntBenchmark: true,
    reason: "Benchmark passed. External DeFi proposals can be inspected in dry-run mode. Live execution is disabled.",
    status: "dry-run",
  };
}

export function latestByrealRun(agent: AgentRecord) {
  return agent.objectiveRuns?.find((run) => run.intent?.kind.startsWith("byreal_"));
}
