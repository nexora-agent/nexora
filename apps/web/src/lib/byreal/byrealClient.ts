import {
  type ByrealPool,
  type ByrealStatus,
  type ByrealToolOutput,
  byrealSupportedTools,
  compareByrealOpportunities,
  createByrealPreview,
  getByrealStatus,
  listByrealPools,
} from "./byrealAdapter";
import type { RiskReport } from "@nexora/shared";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_NEXORA_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

function normalizeStatus(status: Partial<ByrealStatus>): ByrealStatus {
  const fallback = getByrealStatus();
  const mode = status.mode ?? status.adapterMode ?? fallback.mode;

  return {
    ...fallback,
    ...status,
    adapterMode: status.adapterMode ?? mode,
    apiConfigured: Boolean(status.apiConfigured),
    binaryName: status.binaryName ?? null,
    executionEnabled: false,
    executionMode:
      status.executionMode ??
      (mode === "cli_live"
        ? "live"
        : mode === "cli_dry_run"
        ? "dry_run"
        : mode === "cli_read_only" || mode === "api_read_only"
          ? "read_only"
          : "disabled"),
    installed: Boolean(status.installed),
    lastCheckedAt: status.lastCheckedAt ?? fallback.lastCheckedAt,
    mode,
    operatorMessage: status.operatorMessage ?? fallback.operatorMessage,
    supportedTools:
      status.supportedTools?.length || mode !== "demo"
        ? (status.supportedTools ?? byrealSupportedTools)
        : [],
    version: status.version ?? null,
    walletConfigured: Boolean(status.walletConfigured),
  };
}

export async function fetchByrealStatus(): Promise<ByrealStatus> {
  try {
    const response = await fetch(`${apiBaseUrl}/integrations/byreal/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Byreal status request failed: ${response.status}`);
    }

    return normalizeStatus((await response.json()) as Partial<ByrealStatus>);
  } catch (error) {
    const fallback = getByrealStatus();
    return {
      ...fallback,
      errors: [
        ...fallback.errors,
        error instanceof Error ? error.message : "Unable to load Byreal status.",
      ],
    };
  }
}

function normalizePool(pool: Partial<ByrealPool>): ByrealPool {
  return {
    address: pool.address ?? "0x00000000000000000000000000000000000000b1",
    aprBps: Number.isFinite(Number(pool.aprBps)) ? Number(pool.aprBps) : 0,
    id: pool.id ?? pool.address ?? "byreal-pool",
    name: pool.name ?? "Byreal Pool",
    pair: pool.pair ?? "MNT/USDC",
    riskHints: Array.isArray(pool.riskHints)
      ? pool.riskHints.map(String)
      : ["external DeFi target", "External DeFi Preview"],
    riskNote:
      pool.riskNote ??
      "External DeFi Preview candidate. Live execution is disabled.",
    tvlUsd: Number.isFinite(Number(pool.tvlUsd)) ? Number(pool.tvlUsd) : 0,
    volatility:
      pool.volatility === "high" || pool.volatility === "medium" || pool.volatility === "low"
        ? pool.volatility
        : "medium",
  };
}

function normalizeToolOutput<TResult>(
  value: Partial<ByrealToolOutput<TResult>>,
  fallbackResult: TResult,
): ByrealToolOutput<TResult> {
  const status = getByrealStatus();
  const mode = value.mode ?? value.adapterMode ?? status.mode;

  return {
    adapterMode: value.adapterMode ?? mode,
    executionMode: value.executionMode ?? status.executionMode,
    input: value.input ?? {},
    mode,
    result: value.result ?? fallbackResult,
    riskHints: value.riskHints ?? status.errors,
    source: "Byreal / RealClaw",
    timestamp: value.timestamp ?? new Date().toISOString(),
    toolName: value.toolName ?? "byreal_tool",
  };
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Byreal request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchByrealPools(): Promise<ByrealToolOutput<ByrealPool[]>> {
  const fallbackPools = listByrealPools();

  try {
    const output = await apiJson<Partial<ByrealToolOutput<Partial<ByrealPool>[]>>>(
      "/integrations/byreal/pools",
    );
    return normalizeToolOutput(
      {
        ...output,
        result: output.result?.map(normalizePool),
      },
      fallbackPools,
    );
  } catch (error) {
    return normalizeToolOutput(
      {
        executionMode: "disabled",
        mode: "demo",
        riskHints: [
          error instanceof Error ? error.message : "Unable to load Byreal pools.",
          "demo fallback",
        ],
        toolName: "list_byreal_pools",
      },
      fallbackPools,
    );
  }
}

export async function compareByrealOpportunitiesRemote(): Promise<ByrealToolOutput<ByrealPool[]>> {
  const fallbackPools = compareByrealOpportunities();

  try {
    const output = await apiJson<Partial<ByrealToolOutput<Partial<ByrealPool>[]>>>(
      "/integrations/byreal/opportunities/compare",
      {
        body: JSON.stringify({}),
        method: "POST",
      },
    );
    return normalizeToolOutput(
      {
        ...output,
        result: output.result?.map(normalizePool),
      },
      fallbackPools,
    );
  } catch (error) {
    return normalizeToolOutput(
      {
        executionMode: "disabled",
        mode: "demo",
        riskHints: [
          error instanceof Error ? error.message : "Unable to compare Byreal pools.",
          "demo fallback",
        ],
        toolName: "compare_byreal_opportunities",
      },
      fallbackPools,
    );
  }
}

export type ByrealPreview = Omit<ReturnType<typeof createByrealPreview>, "mode"> & {
  mode: ByrealStatus["mode"];
};

export async function previewByrealActionRemote(input: {
  amount?: string;
  poolId?: string;
}): Promise<ByrealToolOutput<ByrealPreview>> {
  const fallbackPool = listByrealPools().find((pool) => pool.id === input.poolId) ?? listByrealPools()[0];
  const fallbackPreview: ByrealPreview = createByrealPreview(fallbackPool, input.amount ?? "0.01");

  try {
    const output = await apiJson<Partial<ByrealToolOutput<Partial<ByrealPreview>>>>(
      "/integrations/byreal/intents/preview",
      {
        body: JSON.stringify(input),
        method: "POST",
      },
    );
    const normalizedPreview: ByrealPreview = {
      ...fallbackPreview,
      ...output.result,
      executionMode: "dry_run",
      liveExecutionEnabled: false,
      mode: output.result?.mode ?? output.mode ?? "demo",
      protocol: "byreal",
      riskHints: output.result?.riskHints ?? fallbackPreview.riskHints,
      target: output.result?.target ?? fallbackPreview.target,
    };

    return normalizeToolOutput(
      {
        ...output,
        result: normalizedPreview,
      },
      fallbackPreview,
    );
  } catch (error) {
    return normalizeToolOutput(
      {
        executionMode: "disabled",
        mode: "demo",
        riskHints: [
          error instanceof Error ? error.message : "Unable to preview Byreal action.",
          "demo fallback",
        ],
        toolName: "create_byreal_action_intent",
      },
      fallbackPreview,
    );
  }
}

export async function analyzeByrealRiskRemote(input: {
  agentId: string;
  amount?: string;
  poolId?: string;
  policy: unknown;
  walletAddress?: `0x${string}`;
}): Promise<{ preview: ByrealToolOutput<ByrealPreview>; report?: RiskReport }> {
  const preview = await previewByrealActionRemote(input);

  try {
    return await apiJson<{ preview: ByrealToolOutput<ByrealPreview>; report?: RiskReport }>(
      "/integrations/byreal/risk/analyze",
      {
        body: JSON.stringify(input),
        method: "POST",
      },
    );
  } catch {
    return {
      preview,
    };
  }
}

export async function executeByrealLiveRemote(input: {
  actionKind: "byreal_swap_preview" | "byreal_lp_deposit_preview";
  amount: string;
  autonomous?: boolean;
  intentHash: `0x${string}`;
  operatorConsent?: string;
  poolId?: string;
  poolName?: string;
}) {
  return apiJson<{
    blockedReason?: string;
    executionEnabled: boolean;
    rawOutput?: string;
    success: boolean;
    timestamp?: string;
  }>("/integrations/byreal/execution/live", {
    body: JSON.stringify(input),
    method: "POST",
  });
}
