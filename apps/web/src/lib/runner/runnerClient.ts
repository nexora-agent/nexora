"use client";

import type { CustomBenchmarkDefinition } from "@/lib/benchmarks/benchmarkDefinition";

export type RunnerMcpServerConfig = {
  enabled: boolean;
  name: string;
  tools: string[];
  url: string;
};

export type ModelProvider = "ollama" | "openai" | "anthropic" | "openai-compatible" | "custom";

export type RunnerConfig = {
  actionAmountMnt: string;
  agentId: string;
  agentObjective: string;
  autoIntervalSeconds: number;
  modelHarness: {
    prompt: string;
  };
  mcpServers: RunnerMcpServerConfig[];
  model: {
    apiKeyEnvVar?: string;
    endpointUrl: string;
    maxTokens: number;
    modelName: string;
    provider: ModelProvider;
    temperature: number;
  };
};

export type RunnerLogEntry = {
  level: "error" | "info";
  message: string;
  timestamp: string;
};

export type LastRunResult = {
  adversarialScore: number;
  averageScore: number;
  basicScore: number;
  benchmarkId?: string;
  benchmarkName?: string;
  decision: {
    action?: string;
    decision?: string;
    reasoning?: string;
    rejectedActions: string[];
    selectedTarget?: string;
  };
  executionDecision?: string;
  executionSkipReason?: string;
  expectedAnswer?: {
    action?: string;
    decision?: string;
    reasoning?: string;
    rejectedActions?: string[];
    selectedTarget?: string;
  };
  externalScore: number;
  passed: boolean;
  passesThresholds?: boolean;
  proposalError?: string;
  score: number;
};

export type RunnerStatus = {
  autoMode: boolean;
  config: RunnerConfig;
  executorAddress?: string;
  executorConfigured?: boolean;
  executorKeyCreatedAt?: string;
  executorKeyPath?: string;
  executorKeySource?: "env" | "local-file" | "missing";
  lastRunExitCode?: number | null;
  lastRunFinishedAt?: string;
  lastRunResult?: LastRunResult;
  logs: RunnerLogEntry[];
  online: boolean;
  runStartedAt?: string;
  running: boolean;
};

function getRunnerApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (process.env.NEXT_PUBLIC_NEXORA_RUNNER_API_URL) {
    return process.env.NEXT_PUBLIC_NEXORA_RUNNER_API_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return "http://127.0.0.1:4000";
}

function getRunnerApiKey() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("nexora.runnerApiKey")?.trim() ?? "";
}

function runnerHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const apiKey = getRunnerApiKey();

  if (init?.body !== undefined && init.body !== null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (apiKey) {
    headers.set("x-nexora-runner-key", apiKey);
  }

  return headers;
}

async function runnerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getRunnerApiBase()}${path}`, {
    ...init,
    headers: runnerHeaders(init),
  });

  const text = await response.text();

  let payload:
    | {
        error?: { message?: string } | string;
        message?: string;
      }
    | undefined;

  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ??
        (typeof payload?.error === "object"
          ? payload.error.message
          : payload?.error) ??
        text ??
        `Runner API returned ${response.status}`,
    );
  }

  return payload as T;
}

export async function getRunnerStatus() {
  return runnerRequest<RunnerStatus>("/runner/status");
}

export async function saveRunnerConfig(config: RunnerConfig) {
  return runnerRequest<RunnerConfig>("/runner/config", {
    body: JSON.stringify(config),
    method: "POST",
  });
}

export async function testRunnerModel(config?: RunnerConfig) {
  return runnerRequest<{
    latencyMs: number;
    ok: boolean;
    response: string;
  }>("/runner/test-model", {
    body: config ? JSON.stringify(config) : undefined,
    method: "POST",
  });
}

export async function testRunnerBenchmark(config?: RunnerConfig) {
  return runnerRequest<{
    activeBenchmark?: {
      benchmarkDataJson?: string;
      benchmarkHash: string;
      benchmarkId: string;
      benchmarkType?: string;
      description?: string;
      metadata?: {
        description?: string;
        expectedAnswer?: {
          action?: string;
          decision?: string;
          rejectedActions?: string[];
          rejectedVaults?: string[];
          reasoning?: string;
          selectedTarget?: string;
          selectedVault?: string;
        };
        name?: string;
        benchmarkType?: string;
      };
      metadataURI?: string;
      name?: string;
      riskMode?: number;
      targetContracts?: string[];
    };
    decision: {
      action?: string;
      decision?: string;
      reasoning?: string;
      rejectedActions?: string[];
      rejectedVaults?: string[];
      selectedTarget?: string;
      selectedVault?: string;
    };
    dryRun?: boolean;
    expectedAnswer?: {
      action?: string;
      decision?: string;
      rejectedActions?: string[];
      rejectedVaults?: string[];
      reasoning?: string;
      selectedTarget?: string;
      selectedVault?: string;
    };
    executionTargets?: string[];
    latencyMs: number;
    modelResponse: string;
    ok: boolean;
    passed: boolean;
    proofPublished?: boolean;
    score: number;
  }>("/runner/test-benchmark", {
    body: config ? JSON.stringify(config) : undefined,
    method: "POST",
  });
}

export async function generateRunnerBenchmarkDraft(input: {
  allowedActions?: string;
  benchmarkName?: string;
  benchmarkType?: CustomBenchmarkDefinition["benchmarkType"];
  blockedActions?: string;
  contractAddress?: string;
  interfaceAbi?: string;
  objective?: string;
  protocolName?: string;
  scenarioProfile?: CustomBenchmarkDefinition["simulation"]["scenarioProfile"];
  scenarioText?: string;
  scoringRules?: string;
}) {
  return runnerRequest<{
    draft: CustomBenchmarkDefinition;
    latencyMs: number;
    modelResponse: string;
    ok: boolean;
  }>("/runner/generate-benchmark", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function testRunnerMcp(url: string) {
  return runnerRequest<{
    latencyMs: number;
    ok: boolean;
    response: string;
  }>("/runner/test-mcp", {
    body: JSON.stringify({ url }),
    method: "POST",
  });
}

export async function runRunnerOnce() {
  return runnerRequest<RunnerStatus>("/runner/run-once", {
    method: "POST",
  });
}

export async function startRunnerAutoMode() {
  return runnerRequest<RunnerStatus>("/runner/start", {
    method: "POST",
  });
}

export async function stopRunnerAutoMode() {
  return runnerRequest<RunnerStatus>("/runner/stop", {
    method: "POST",
  });
}
