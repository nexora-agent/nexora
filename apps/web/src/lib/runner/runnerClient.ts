"use client";

export type RunnerMcpServerConfig = {
  enabled: boolean;
  name: string;
  tools: string[];
  url: string;
};

export type RunnerConfig = {
  actionAmountMnt: string;
  agentId: string;
  autoIntervalSeconds: number;
  modelHarness: {
    prompt: string;
  };
  mcpServers: RunnerMcpServerConfig[];
  model: {
    endpointUrl: string;
    maxTokens: number;
    modelName: string;
    provider: "ollama";
    temperature: number;
  };
};

export type RunnerLogEntry = {
  level: "error" | "info";
  message: string;
  timestamp: string;
};

export type RunnerStatus = {
  autoMode: boolean;
  config: RunnerConfig;
  executorAddress?: string;
  lastRunExitCode?: number | null;
  lastRunFinishedAt?: string;
  logs: RunnerLogEntry[];
  online: boolean;
  runStartedAt?: string;
  running: boolean;
};

function getRunnerApiBase() {
  if (process.env.NEXT_PUBLIC_NEXORA_RUNNER_API_URL) {
    return process.env.NEXT_PUBLIC_NEXORA_RUNNER_API_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return "http://127.0.0.1:4000";
}

async function runnerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getRunnerApiBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
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
        (typeof payload?.error === "object" ? payload.error.message : payload?.error) ??
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
  return runnerRequest<{ latencyMs: number; ok: boolean; response: string }>("/runner/test-model", {
    body: config ? JSON.stringify(config) : undefined,
    method: "POST",
  });
}

export async function testRunnerBenchmark(config?: RunnerConfig) {
  return runnerRequest<{
    decision: {
      reasoning?: string;
      rejectedVaults?: string[];
      selectedVault?: string;
    };
    latencyMs: number;
    modelResponse: string;
    ok: boolean;
    passed: boolean;
    score: number;
  }>("/runner/test-benchmark", {
    body: config ? JSON.stringify(config) : undefined,
    method: "POST",
  });
}

export async function testRunnerMcp(url: string) {
  return runnerRequest<{ latencyMs: number; ok: boolean; response: string }>("/runner/test-mcp", {
    body: JSON.stringify({ url }),
    method: "POST",
  });
}

export async function runRunnerOnce() {
  return runnerRequest<RunnerStatus>("/runner/run-once", { method: "POST" });
}

export async function startRunnerAutoMode() {
  return runnerRequest<RunnerStatus>("/runner/start", { method: "POST" });
}

export async function stopRunnerAutoMode() {
  return runnerRequest<RunnerStatus>("/runner/stop", { method: "POST" });
}
