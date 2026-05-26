import type { ByrealPool } from "./byrealTypes";

function asNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asAddress(value: unknown, fallback: `0x${string}`): `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as `0x${string}`)
    : fallback;
}

function riskHintsFromPool(pool: Pick<ByrealPool, "aprBps" | "tvlUsd" | "volatility">) {
  const hints = ["external DeFi target", "dry-run only"];

  if (pool.aprBps >= 1500) {
    hints.push("high APR warning");
  }

  if (pool.tvlUsd < 100000) {
    hints.push("low TVL warning");
  }

  if (pool.volatility === "high") {
    hints.push("high volatility warning");
  }

  return hints;
}

export function normalizeByrealPool(
  input: Record<string, unknown>,
  index: number,
): ByrealPool {
  const aprBps = asNumber(input.aprBps ?? input.apr_bps ?? input.apr, 0);
  const tvlUsd = asNumber(input.tvlUsd ?? input.tvl_usd ?? input.tvl, 0);
  const volatility =
    input.volatility === "high" || input.volatility === "low" || input.volatility === "medium"
      ? input.volatility
      : aprBps >= 1500 || tvlUsd < 100000
        ? "high"
        : aprBps >= 500
          ? "medium"
          : "low";
  const pool = {
    address: asAddress(
      input.address ?? input.poolAddress ?? input.pool_address,
      `0x0000000000000000000000000000000000000b${index + 1}` as `0x${string}`,
    ),
    aprBps,
    id: String(input.id ?? input.poolId ?? input.address ?? `byreal-pool-${index + 1}`),
    name: String(input.name ?? input.poolName ?? `Byreal Pool ${index + 1}`),
    pair: String(input.pair ?? input.symbol ?? input.tokenPair ?? "MNT/USDC"),
    tvlUsd,
    volatility,
  } satisfies Omit<ByrealPool, "riskHints">;

  return {
    ...pool,
    riskHints: Array.isArray(input.riskHints)
      ? input.riskHints.map(String)
      : riskHintsFromPool(pool),
  };
}

export function normalizeByrealPoolList(payload: unknown): ByrealPool[] {
  const source =
    Array.isArray(payload)
      ? payload
      : typeof payload === "object" && payload
        ? ((payload as { data?: unknown; result?: unknown; pools?: unknown }).data ??
            (payload as { result?: unknown }).result ??
            (payload as { pools?: unknown }).pools)
        : [];

  return Array.isArray(source)
    ? source
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map(normalizeByrealPool)
    : [];
}
