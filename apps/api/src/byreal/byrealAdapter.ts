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
    riskNote: "Demo adapter pool; bounded intent proposal only.",
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

export function getByrealPools() {
  return byrealPools;
}

export function inspectByrealPool(poolId = byrealPools[0].id) {
  return byrealPools.find((pool) => pool.id === poolId) ?? byrealPools[0];
}
