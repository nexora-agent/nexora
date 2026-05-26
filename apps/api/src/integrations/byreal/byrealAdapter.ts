import { byrealDemoPools } from "./byrealDemoData";
import { mapByrealError } from "./byrealErrorMapper";
import { parseJsonOutput, runByrealCommand } from "./byrealCommandRunner";
import { normalizeByrealPoolList } from "./byrealNormalizer";
import { getByrealStatus } from "./byrealStatus";
import type { ByrealMode, ByrealPool, ByrealToolOutput } from "./byrealTypes";

function output<TInput, TResult>(
  toolName: string,
  input: TInput,
  result: TResult,
  riskHints: string[],
  executionMode: "read_only" | "dry_run" | "disabled" = "read_only",
  mode: ByrealMode = "demo",
): ByrealToolOutput<TInput, TResult> {
  return {
    adapterMode: mode,
    executionMode,
    input,
    mode,
    result,
    riskHints,
    source: "Byreal / RealClaw",
    timestamp: new Date().toISOString(),
    toolName,
  };
}

function demoPoolsOutput(input: Record<string, unknown> = {}) {
  const status = getByrealStatus();
  return output(
    "list_byreal_pools",
    input,
    byrealDemoPools,
    status.errors.length
      ? status.errors
      : ["external DeFi target", "dry-run only", "demo fallback"],
    status.mode === "demo" ? "disabled" : "read_only",
    status.mode,
  );
}

async function fetchByrealApiPools(apiBaseUrl: string) {
  const url = new URL("/byreal/api/dex/v2/pools/info/list", apiBaseUrl);
  const response = await fetch(url, { headers: { accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`Byreal API returned ${response.status}`);
  }

  return normalizeByrealPoolList(await response.json());
}

function readByrealCliPools(binaryName: string) {
  const payload =
    parseJsonOutput<unknown>(runByrealCommand(binaryName, ["pools", "list", "--json"])) ??
    parseJsonOutput<unknown>(runByrealCommand(binaryName, ["pools", "list", "--output", "json"]));

  return normalizeByrealPoolList(payload);
}

async function readOnlyPools() {
  const status = getByrealStatus();

  try {
    if (status.mode === "api_read_only" && status.apiBaseUrl) {
      const pools = await fetchByrealApiPools(status.apiBaseUrl);
      if (pools.length > 0) {
        return output(
          "list_byreal_pools",
          { apiBaseUrl: status.apiBaseUrl },
          pools,
          ["external DeFi target", "read-only source"],
          "read_only",
          status.mode,
        );
      }
    }

    if ((status.mode === "cli_read_only" || status.mode === "cli_dry_run") && status.binaryName) {
      const pools = readByrealCliPools(status.binaryName);
      if (pools.length > 0) {
        return output(
          "list_byreal_pools",
          { binaryName: status.binaryName },
          pools,
          ["external DeFi target", status.mode === "cli_dry_run" ? "dry-run only" : "read-only source"],
          status.executionMode,
          status.mode,
        );
      }
    }
  } catch (error) {
    return {
      ...demoPoolsOutput({ fallbackReason: mapByrealError(error) }),
      riskHints: [mapByrealError(error), "demo fallback"],
    };
  }

  return demoPoolsOutput();
}

export function getByrealStatusTool() {
  const status = getByrealStatus();
  const result = output("get_byreal_status", {}, status, status.errors, status.executionMode);
  return {
    ...result,
    adapterMode: status.adapterMode,
    mode: status.mode,
  };
}

export async function getByrealOverviewReadOnly() {
  const status = getByrealStatus();
  const pools = await readOnlyPools();

  return output(
    "get_byreal_overview",
    {},
    {
      executionEnabled: false,
      executionMode: status.executionMode,
      liveExecutionEnabled: false,
      mode: status.mode,
      operatorMessage: status.operatorMessage,
      poolCount: pools.result.length,
    },
    status.errors.length ? status.errors : ["read-only external DeFi surface"],
    status.executionMode,
    status.mode,
  );
}

export function listByrealPools() {
  return output(
    "list_byreal_pools",
    {},
    byrealDemoPools,
    ["external DeFi target", "dry-run only"],
    "read_only",
  );
}

export async function listByrealPoolsReadOnly() {
  return readOnlyPools();
}

export function inspectByrealPool(poolId = byrealDemoPools[0].id) {
  const pool = byrealDemoPools.find((candidate) => candidate.id === poolId) ?? byrealDemoPools[0];
  return output("inspect_byreal_pool", { poolId }, pool, pool.riskHints, "read_only");
}

export async function inspectByrealPoolReadOnly(poolId = byrealDemoPools[0].id) {
  const pools = await readOnlyPools();
  const pool = pools.result.find((candidate) => candidate.id === poolId) ?? pools.result[0];

  return output(
    "inspect_byreal_pool",
    { poolId },
    pool,
    pool?.riskHints ?? ["external DeFi target"],
    pools.executionMode,
    pools.mode,
  );
}

export function compareByrealOpportunities(pools: ByrealPool[] = byrealDemoPools) {
  const ranked = [...pools].sort((a, b) => {
    const volatilityPenalty = { high: 700, low: 0, medium: 180 };
    const lowTvlPenalty = (pool: ByrealPool) => (pool.tvlUsd < 100000 ? 250 : 0);
    const aScore =
      a.aprBps / 10 +
      Math.min(a.tvlUsd / 1000, 500) -
      volatilityPenalty[a.volatility] -
      lowTvlPenalty(a);
    const bScore =
      b.aprBps / 10 +
      Math.min(b.tvlUsd / 1000, 500) -
      volatilityPenalty[b.volatility] -
      lowTvlPenalty(b);
    return bScore - aScore;
  });

  return output(
    "compare_byreal_opportunities",
    { poolCount: pools.length },
    ranked,
    ["high APR is not automatically safe", "low TVL increases risk"],
    "read_only",
  );
}

export async function compareByrealOpportunitiesReadOnly() {
  const pools = await readOnlyPools();
  const ranked = [...pools.result].sort((a, b) => {
    const volatilityPenalty = { high: 700, low: 0, medium: 180 };
    const lowTvlPenalty = (pool: ByrealPool) => (pool.tvlUsd < 100000 ? 250 : 0);
    const aScore =
      a.aprBps / 10 +
      Math.min(a.tvlUsd / 1000, 500) -
      volatilityPenalty[a.volatility] -
      lowTvlPenalty(a);
    const bScore =
      b.aprBps / 10 +
      Math.min(b.tvlUsd / 1000, 500) -
      volatilityPenalty[b.volatility] -
      lowTvlPenalty(b);
    return bScore - aScore;
  });

  return output(
    "compare_byreal_opportunities",
    { poolCount: ranked.length },
    ranked,
    ["high APR is not automatically safe", "low TVL increases risk"],
    pools.executionMode,
    pools.mode,
  );
}

export function createByrealActionIntent(poolId = byrealDemoPools[0].id, amount = "0.01") {
  const pool = byrealDemoPools.find((candidate) => candidate.id === poolId) ?? byrealDemoPools[0];
  return output(
    "create_byreal_action_intent",
    { amount, poolId },
    {
      amount,
      asset: "MNT",
      executionMode: "dry_run",
      expectedYield: pool.aprBps >= 1000 ? "high" : pool.aprBps >= 500 ? "medium" : "low",
      liveExecutionEnabled: false,
      mode: "demo",
      poolName: pool.name,
      protocol: "byreal",
      riskHints: ["bounded amount", "dry-run only"],
      target: pool.address,
    },
    ["bounded action", "dry-run only", "live execution disabled"],
    "dry_run",
  );
}

export async function createByrealActionPreview(poolId = byrealDemoPools[0].id, amount = "0.01") {
  const inspected = await inspectByrealPoolReadOnly(poolId);
  const pool = inspected.result;

  return output(
    "create_byreal_action_intent",
    { amount, poolId },
    {
      amount,
      asset: "MNT",
      executionMode: "dry_run",
      expectedYield: pool.aprBps >= 1000 ? "high" : pool.aprBps >= 500 ? "medium" : "low",
      liveExecutionEnabled: false,
      mode: inspected.mode,
      poolName: pool.name,
      protocol: "byreal",
      riskHints: ["bounded amount", "dry-run only", ...pool.riskHints],
      target: pool.address,
    },
    ["bounded action", "dry-run only", "live execution disabled"],
    "dry_run",
    inspected.mode,
  );
}
