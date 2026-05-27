import type { AgentRecord, HarnessTemplate, ObjectiveRun, PolicyProfile } from "@nexora/shared";
import { getNexoraApi, postNexoraApi } from "@/lib/api/nexoraApi";
import {
  type BenchmarkScenario,
  benchmarkScenarios,
  parseBenchmarkModelDecision,
} from "@/lib/benchmark/runAiMntBenchmark";
import { nexoraMntVaults } from "@/lib/benchmark/mntVaults";
import { runMntBenchmarkWithDecision } from "@/lib/objectives/runObjectiveLocally";

export type LocalHarnessRunResult = {
  auth?: {
    signed: boolean;
    signatureHeader?: string;
  };
  latencyMs: number;
  mode: "local-runtime";
  request: unknown;
  requestHash?: string;
  response: unknown;
  responseHash?: string;
  runId?: string;
  runtimeUrl: string;
  toolManifest?: {
    allowedToolNames: string[];
    hash: string;
  };
  usedTools?: string[];
};

export type LocalHarnessRunLogEntry = {
  agentId?: string;
  createdAt: string;
  endpointHost: string;
  error?: string;
  harnessId: string;
  latencyMs: number;
  objective: string;
  requestHash: string;
  responseHash?: string;
  runId: string;
  status: "success" | "error";
  toolCount: number;
  usedTools: string[];
};

function responseText(response: unknown) {
  if (typeof response === "string") {
    return response;
  }

  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    const nested =
      record.decision ??
      record.result ??
      record.output ??
      record.response ??
      record;

    if (typeof nested === "string") {
      return nested;
    }

    return JSON.stringify(nested);
  }

  return String(response ?? "");
}

function benchmarkContext() {
  return {
    asset: "MNT",
    benchmarkName: "AI MNT Strategy Benchmark",
    network: "Mantle Sepolia",
    task: "Choose the safest vault for a conservative 0.01 MNT benchmark deposit.",
    vaults: nexoraMntVaults.map((vault) => ({
      address: vault.address,
      expectedYieldBps: vault.expectedYieldBps,
      name: vault.name,
      riskProfile: vault.riskProfile,
      verificationStatus: vault.verificationStatus,
    })),
  };
}

export async function runLocalHarnessBenchmark(input: {
  agent: AgentRecord;
  harness: HarnessTemplate;
  policy: PolicyProfile;
  scenario?: BenchmarkScenario;
}): Promise<ObjectiveRun> {
  if (!input.harness.localRuntimeUrl) {
    throw new Error("This harness does not have a local runtime URL.");
  }

  const scenario = input.scenario ?? benchmarkScenarios[1];
  const objective = scenario.objective;
  const result = await postNexoraApi<LocalHarnessRunResult>("/harness/local/run", {
    agent: {
      id: input.agent.id,
      name: input.agent.name,
      walletAddress: input.agent.walletAddress,
    },
    benchmarkContext: benchmarkContext(),
    endpointUrl: input.harness.localRuntimeUrl,
    harness: input.harness,
    localRuntimeSecret: input.harness.localRuntimeSecret,
    objective,
    policy: input.policy,
    timeoutMs: 45000,
  });
  const rawResponse = responseText(result.response);
  const decision = parseBenchmarkModelDecision(rawResponse, scenario);

  return runMntBenchmarkWithDecision(input.agent, objective, {
    benchmarkLevel: scenario.id,
    benchmarkUnlock: scenario.unlock,
    failure: !decision.valid,
    graderWarnings: decision.warnings,
    hallucination: decision.hallucination,
    inconsistent: decision.inconsistent,
    latencyMs: result.latencyMs,
    modelName: `Local harness · ${input.harness.name}`,
    prompt: JSON.stringify(result.request, null, 2),
    rawResponse,
    reasoning: decision.valid
      ? decision.reasoning
      : `Invalid local harness response. Raw response: ${rawResponse.slice(0, 300)}`,
    rejectedVaults: decision.rejectedVaults,
    selectedVaultName: decision.selectedVault,
    source: "llm",
  });
}

export async function testLocalHarnessRuntime(input: {
  agent: AgentRecord;
  endpointUrl: string;
  harness: HarnessTemplate;
  objective: string;
  policy: PolicyProfile;
}) {
  return postNexoraApi<LocalHarnessRunResult>("/harness/local/run", {
    agent: {
      id: input.agent.id,
      name: input.agent.name,
      walletAddress: input.agent.walletAddress,
    },
    benchmarkContext: benchmarkContext(),
    endpointUrl: input.endpointUrl,
    harness: input.harness,
    localRuntimeSecret: input.harness.localRuntimeSecret,
    objective: input.objective,
    policy: input.policy,
    timeoutMs: 15000,
  });
}

export async function listLocalHarnessRuns(limit = 10) {
  return getNexoraApi<{ runs: LocalHarnessRunLogEntry[] }>(
    `/harness/local/runs?limit=${limit}`,
  );
}
