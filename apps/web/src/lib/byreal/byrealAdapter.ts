export type ByrealPool = {
  id: string;
  name: string;
  pair: string;
  address: `0x${string}`;
  tvlUsd: number;
  aprBps: number;
  volatility: "low" | "medium" | "high";
  riskNote: string;
  riskHints: string[];
};

export type ByrealStatus = {
  mode: ByrealMode;
  adapterMode: ByrealMode;
  apiBaseUrl?: string;
  apiConfigured: boolean;
  binaryName: string | null;
  installed: boolean;
  lastCheckedAt: string;
  operatorMessage: string;
  version: string | null;
  walletConfigured: boolean;
  supportedTools: string[];
  executionEnabled: false;
  executionMode: "read_only" | "dry_run" | "disabled";
  errors: string[];
};

export type ByrealMode =
  | "demo"
  | "api_read_only"
  | "cli_read_only"
  | "cli_dry_run"
  | "disabled";

export const byrealSupportedTools = [
  "get_byreal_status",
  "list_byreal_pools",
  "inspect_byreal_pool",
  "compare_byreal_opportunities",
  "create_byreal_action_intent",
  "analyze_byreal_action_risk",
];

export const byrealPools: ByrealPool[] = [
  {
    id: "byreal-usdc-mnt-core",
    name: "Byreal USDC/MNT Core Pool",
    pair: "USDC/MNT",
    address: "0x00000000000000000000000000000000000000b1",
    tvlUsd: 420000,
    aprBps: 640,
    volatility: "medium",
    riskNote: "Bounded intent proposal only.",
    riskHints: ["bounded amount", "dry-run only", "external DeFi target"],
  },
  {
    id: "byreal-usdc-usdt-stable",
    name: "Byreal USDC/USDT Stable Pool",
    pair: "USDC/USDT",
    address: "0x00000000000000000000000000000000000000b2",
    tvlUsd: 690000,
    aprBps: 310,
    volatility: "low",
    riskNote: "Stable pair candidate for low-slippage inspection.",
    riskHints: ["stable pair", "dry-run only", "bounded action"],
  },
  {
    id: "byreal-demo-high-apr",
    name: "Byreal Demo High APR Pool",
    pair: "MNT/DEMO",
    address: "0x00000000000000000000000000000000000000b3",
    tvlUsd: 38000,
    aprBps: 4200,
    volatility: "high",
    riskNote: "High advertised yield with low liquidity and high volatility.",
    riskHints: ["high APR warning", "low TVL warning", "high volatility warning"],
  },
];

export function inspectByrealPool(objective: string) {
  const normalized = objective.toLowerCase();
  if (normalized.includes("unsafe") || normalized.includes("high apr") || normalized.includes("reject")) {
    return byrealPools[2];
  }

  return normalized.includes("stable")
    ? byrealPools[1]
    : byrealPools[0];
}

export function getByrealStatus(): ByrealStatus {
  return {
    adapterMode: "demo",
    apiConfigured: false,
    binaryName: null,
    errors: ["Demo adapter active. Live execution is disabled in this build."],
    executionEnabled: false,
    executionMode: "disabled",
    installed: false,
    lastCheckedAt: new Date().toISOString(),
    mode: "demo",
    operatorMessage:
      "Demo adapter active. Configure the API or local byreal-cli for read-only checks.",
    supportedTools: [],
    version: null,
    walletConfigured: false,
  };
}

export function listByrealPools() {
  return byrealPools;
}

export function compareByrealOpportunities(pools = byrealPools) {
  const volatilityPenalty = { high: 3000, low: 300, medium: 1200 };
  return [...pools].sort((a, b) => {
    const aScore = a.aprBps - volatilityPenalty[a.volatility] + Math.min(a.tvlUsd / 1000, 500);
    const bScore = b.aprBps - volatilityPenalty[b.volatility] + Math.min(b.tvlUsd / 1000, 500);
    return bScore - aScore;
  });
}

export function createByrealPreview(pool: ByrealPool, amount = "0.01") {
  return {
    amount,
    asset: "MNT",
    executionMode: "dry_run" as const,
    expectedYield: pool.aprBps >= 1000 ? "high" : pool.aprBps >= 500 ? "medium" : "low",
    liveExecutionEnabled: false,
    mode: "demo" as const,
    poolName: pool.name,
    protocol: "byreal",
    riskHints: ["bounded amount", "dry-run only", ...pool.riskHints],
    target: pool.address,
  };
}
