"use client";

import { readContract } from "@wagmi/core";
import { formatEther, parseEther } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { nexoraBenchmarkDexAbi } from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

export type DexScenario =
  | "stable_sideways"
  | "slow_uptrend"
  | "high_volatility"
  | "thin_liquidity"
  | "no_liquidity";

export type DexMarketState = {
  mntReserveMnt: string;
  tokenReserve: string;
  spotPriceMntPerToken: string;
  liquidityDepthLabel: "deep" | "normal" | "thin" | "empty";
  priceImpactBps: number;
  expectedTokenOut: string;
  slippageBps: number;
  scenario: DexScenario;
  scenarioLabel: string;
  isLowLiquidity: boolean;
  isHighImpact: boolean;
  tradeAmountMnt: string;
  dexAddress: string;
  timestamp: number;
};

const TRADE_AMOUNT_MNT = "0.01";
const TRADE_AMOUNT_WEI = parseEther(TRADE_AMOUNT_MNT);

const SCENARIO_LABELS: Record<DexScenario, string> = {
  stable_sideways: "Stable sideways market",
  slow_uptrend: "Moderate liquidity market",
  high_volatility: "High volatility / thin liquidity",
  thin_liquidity: "Thin liquidity trap",
  no_liquidity: "No liquidity — empty pool",
};

function classifyScenario(mntReserveMnt: number, priceImpactBps: number): DexScenario {
  if (mntReserveMnt === 0) return "no_liquidity";
  if (mntReserveMnt < 0.02) return "thin_liquidity";
  if (priceImpactBps > 800) return "high_volatility";
  if (priceImpactBps > 300) return "slow_uptrend";
  return "stable_sideways";
}

export async function readDexMarketState(): Promise<DexMarketState> {
  const dexAddress = mantleSepoliaContracts.benchmarkDex as `0x${string}`;

  const [mntReserveWei, tokenReserveWei] = await readContract(wagmiConfig, {
    abi: nexoraBenchmarkDexAbi,
    address: dexAddress,
    chainId: mantleSepolia.id,
    functionName: "reserves",
  });

  const mntReserveMnt = Number(formatEther(mntReserveWei));
  const tokenReserveMnt = Number(formatEther(tokenReserveWei));

  let expectedTokenOutWei = 0n;
  if (mntReserveWei > 0n && tokenReserveWei > 0n) {
    expectedTokenOutWei = await readContract(wagmiConfig, {
      abi: nexoraBenchmarkDexAbi,
      address: dexAddress,
      chainId: mantleSepolia.id,
      functionName: "quoteMntForTokens",
      args: [TRADE_AMOUNT_WEI],
    });
  }

  // Ideal output without fee = tradeAmount * tokenReserve / (mntReserve + tradeAmount)
  const idealOut =
    mntReserveWei > 0n && tokenReserveWei > 0n
      ? (TRADE_AMOUNT_WEI * tokenReserveWei) / (mntReserveWei + TRADE_AMOUNT_WEI)
      : 0n;

  const slippageBps =
    idealOut > 0n
      ? Math.round(Number(((idealOut - expectedTokenOutWei) * 10000n) / idealOut))
      : 0;

  // Price impact = what fraction of the pool the trade consumes
  const priceImpactBps =
    mntReserveWei > 0n
      ? Math.round(Number((TRADE_AMOUNT_WEI * 10000n) / (mntReserveWei + TRADE_AMOUNT_WEI)))
      : 10000;

  const spotPriceMntPerToken =
    tokenReserveMnt > 0 ? (mntReserveMnt / tokenReserveMnt).toFixed(6) : "N/A";

  const scenario = classifyScenario(mntReserveMnt, priceImpactBps);

  const liquidityDepthLabel: DexMarketState["liquidityDepthLabel"] =
    mntReserveWei === 0n
      ? "empty"
      : mntReserveMnt < 0.02
        ? "thin"
        : mntReserveMnt < 0.5
          ? "normal"
          : "deep";

  return {
    mntReserveMnt: mntReserveMnt.toFixed(6),
    tokenReserve: tokenReserveMnt.toFixed(6),
    spotPriceMntPerToken,
    liquidityDepthLabel,
    priceImpactBps,
    expectedTokenOut: Number(formatEther(expectedTokenOutWei)).toFixed(8),
    slippageBps,
    scenario,
    scenarioLabel: SCENARIO_LABELS[scenario],
    isLowLiquidity: mntReserveMnt < 0.1 || priceImpactBps > 500,
    isHighImpact: priceImpactBps > 300,
    tradeAmountMnt: TRADE_AMOUNT_MNT,
    dexAddress,
    timestamp: Date.now(),
  };
}

export function fallbackDexMarketState(): DexMarketState {
  return {
    mntReserveMnt: "0.000000",
    tokenReserve: "0.000000",
    spotPriceMntPerToken: "N/A",
    liquidityDepthLabel: "empty",
    priceImpactBps: 10000,
    expectedTokenOut: "0.00000000",
    slippageBps: 0,
    scenario: "no_liquidity",
    scenarioLabel: SCENARIO_LABELS.no_liquidity,
    isLowLiquidity: true,
    isHighImpact: true,
    tradeAmountMnt: TRADE_AMOUNT_MNT,
    dexAddress: mantleSepoliaContracts.benchmarkDex,
    timestamp: Date.now(),
  };
}
