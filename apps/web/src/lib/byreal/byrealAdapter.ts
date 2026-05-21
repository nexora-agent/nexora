export type ByrealPool = {
  id: string;
  name: string;
  pair: string;
  address: `0x${string}`;
  tvlUsd: number;
  riskNote: string;
};

export const byrealPools: ByrealPool[] = [
  {
    id: "byreal-usdc-mnt-core",
    name: "Byreal USDC/MNT Core Pool",
    pair: "USDC/MNT",
    address: "0x00000000000000000000000000000000000000b1",
    tvlUsd: 420000,
    riskNote: "Bounded intent proposal only.",
  },
  {
    id: "byreal-usdc-usdt-stable",
    name: "Byreal USDC/USDT Stable Pool",
    pair: "USDC/USDT",
    address: "0x00000000000000000000000000000000000000b2",
    tvlUsd: 690000,
    riskNote: "Stable pair candidate for low-slippage inspection.",
  },
];

export function inspectByrealPool(objective: string) {
  return objective.toLowerCase().includes("stable")
    ? byrealPools[1]
    : byrealPools[0];
}
