import type {
  AgentRecord,
  RunnerMode,
  SmartWalletModelConfig,
  SmartWalletToolConfig,
  SmartWalletToolGroup,
  SmartWalletToolStatus,
} from "@nexora/shared";
import { getHarnessTemplate } from "./harness/harnessTemplates";

export const defaultModelConfig: SmartWalletModelConfig = {
  connectionType: "demo",
  endpointUrl: "",
  executionMode: "simulation",
  maxTokens: 4096,
  modelName: "Nexora Demo Model",
  provider: "demo",
  runnerMode: "demo",
  temperature: 0.2,
};

const groupLabels: Record<SmartWalletToolGroup, string> = {
  "benchmark-defi": "Benchmark DeFi Tools",
  byreal: "RealClaw / Byreal Tools",
  risk: "Risk Tools",
  wallet: "Wallet Tools",
};

const statusLabels: Record<SmartWalletToolStatus, string> = {
  "coming-soon": "Coming soon",
  demo: "Demo",
  live: "Live",
};

export function toolGroupLabel(group: SmartWalletToolGroup) {
  return groupLabels[group];
}

export function toolStatusLabel(status: SmartWalletToolStatus) {
  return statusLabels[status];
}

export function modelConfigForRunner(runnerMode: RunnerMode): SmartWalletModelConfig {
  if (runnerMode === "local") {
    return {
      connectionType: "openai-compatible",
      endpointUrl: "http://localhost:11434/v1",
      executionMode: "policy-gated",
      maxTokens: 4096,
      modelName: "local-model",
      provider: "local",
      runnerMode,
      temperature: 0.2,
    };
  }

  if (runnerMode === "hosted") {
    return {
      connectionType: "custom-http",
      endpointUrl: "",
      executionMode: "live-disabled",
      maxTokens: 4096,
      modelName: "Hosted Model",
      provider: "hosted",
      runnerMode,
      temperature: 0.2,
    };
  }

  return defaultModelConfig;
}

export function normalizeModelConfig(agent: AgentRecord): SmartWalletModelConfig {
  return agent.modelConfig ?? modelConfigForRunner(agent.runnerMode ?? "demo");
}

export function defaultToolsForHarness(harnessId = "safe-approval"): SmartWalletToolConfig[] {
  const harness = getHarnessTemplate(harnessId);
  const harnessTools = harness.tools.map((tool): SmartWalletToolConfig => {
    const isByreal = tool.sponsorSurface === "byreal" || tool.id.includes("byreal");
    const isRisk = tool.id.includes("risk") || tool.id.includes("analyze");
    const isDefi = tool.id.includes("pool") || tool.id.includes("swap") || tool.id.includes("yield");

    return {
      description: tool.description,
      enabled: true,
      group: isByreal ? "byreal" : isRisk ? "risk" : isDefi ? "benchmark-defi" : "wallet",
      id: tool.id,
      name: tool.name,
      status: isByreal ? "demo" : "live",
    };
  });

  const baselineTools: SmartWalletToolConfig[] = [
    {
      description: "Create deterministic benchmark score breakdowns for test runs.",
      enabled: true,
      group: "benchmark-defi",
      id: "score_benchmark_run",
      name: "score_benchmark_run",
      status: "live",
    },
    {
      description: "Future live RealClaw / Byreal execution adapter.",
      enabled: false,
      group: "byreal",
      id: "realclaw_live_execution",
      name: "realclaw_live_execution",
      status: "coming-soon",
    },
  ];

  const byId = new Map<string, SmartWalletToolConfig>();
  [...harnessTools, ...baselineTools].forEach((tool) => byId.set(tool.id, tool));
  return [...byId.values()];
}

export function normalizeToolsConfig(agent: AgentRecord): SmartWalletToolConfig[] {
  return agent.toolsConfig ?? defaultToolsForHarness(agent.selectedHarnessId);
}

export function enabledToolsCount(agent: AgentRecord) {
  return normalizeToolsConfig(agent).filter((tool) => tool.enabled).length;
}
