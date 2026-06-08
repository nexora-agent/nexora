import { zeroAddress } from "viem";

export const mantleSepoliaContracts = {
  agentIdentity: "0x036FA3bD24B39599b873F0A81B27AeE58a7d5cDE",
  agentIdentityRegistry: "0x51A9Fee88E251bB26f71bE9D875E5269979780b1",
  agent4337WalletFactory: "0x9E4Efb4566FD381df50B6baC138722BC1B6714B0",
  agentValidationRegistry: "0x69d2D8C1ecB6496F116Ce774B855c50Fa6AD48a5",
  agentReputationRegistry: "0x1105b200e2753937B3304525De1170B2bCF223CD",
  benchmarkDex: "0x6c496706067ba1Ed506d5C178a7411fEE10C6331",
  benchmarkRegistry: "0x0041dE1175281C5B3980F298c251BbCAFFdF31d6",
  benchmarkToken: "0x39DFFCE3B20dF950a7914314fa3186EDDF261470",
  entryPoint: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  factory: "0xd4baC9D28623379f57597F39955029eA04c1d6AB",
  policy: "0xF0EE353155699201774284094218c6EECaF72F6D",
  preflightRegistry: "0x4e241927b4A6ed76Ae1118d82d45097f81257b7A",
  riskRegistry: "0xeC578C16c233Cd4b4eC8d5F7A5D34f15BC1bAe2E",
  reputation: "0xAB2737B31dF7b3FD8041182C67C5A5F6811C19e7",
  riskyVault: "0x33A154a3178fA675bA41D04BF95eeC0DF9f336da",
  safeVault: "0x1b875C3A18EB2A13dfA396D4337952FBBf7fD6e4",
  smartWalletRegistry: "0xb68b468fA9345D8EBdf091391bd9BB9336972Fa9",
  volatileVault: "0x17CE82Be617f3685D89D981BcAeFc72C1636f58C",
} as const;

function hasContractAddress(address: string) {
  return address.toLowerCase() !== zeroAddress.toLowerCase();
}

export function isAgentWalletDeploymentReady() {
  return [
    mantleSepoliaContracts.agentIdentityRegistry,
    mantleSepoliaContracts.agent4337WalletFactory,
    mantleSepoliaContracts.agentValidationRegistry,
  ].every(hasContractAddress);
}

export function isBenchmarkRegistryReady() {
  return hasContractAddress(mantleSepoliaContracts.benchmarkRegistry);
}

export function isBundlerReady() {
  return isAgentWalletDeploymentReady() && hasContractAddress(mantleSepoliaContracts.entryPoint);
}
