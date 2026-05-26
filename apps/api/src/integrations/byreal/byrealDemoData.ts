import type { ByrealPool } from "./byrealTypes";

export const byrealDemoPools: ByrealPool[] = [
  {
    id: "byreal-demo-mnt-safe",
    name: "Byreal Demo MNT Pool",
    pair: "MNT/USDC",
    address: "0x00000000000000000000000000000000000000b1",
    tvlUsd: 420000,
    aprBps: 640,
    volatility: "medium",
    riskHints: ["bounded amount", "dry-run only", "external DeFi target"],
  },
  {
    id: "byreal-demo-stable",
    name: "Byreal Demo Stable Pool",
    pair: "USDC/USDT",
    address: "0x00000000000000000000000000000000000000b2",
    tvlUsd: 690000,
    aprBps: 310,
    volatility: "low",
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
    riskHints: ["high APR warning", "low TVL warning", "high volatility warning"],
  },
];
