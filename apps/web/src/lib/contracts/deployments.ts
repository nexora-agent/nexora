import { zeroAddress } from "viem";

export const mantleSepoliaContracts = {
  agentIdentity: "0xfE84E525441723e2A4710F2eC65f55ADa824Afc5",
  agentIdentityRegistry: "0x7ADe45FD922036B94C5195B26c2Ee9FE06daA4af",
  agent4337WalletFactory: "0xC9c0755a0c57a223D61ad1D132A2c6d886Ff842d",
  agentValidationRegistry: "0xF2E9458963514F49161b2BBdD8fB8216d03E6b27",
  agentReputationRegistry: "0xC41156d0BC62862701C43088CEE2B31A910B4f0b",
  benchmarkDex: "0xa3686137abf9e43363ac93e8052625a65526a7fb",
  benchmarkRegistry: "0x9DBE5ae4940BEE27a615AC32131D4175edB69541",
  benchmarkToken: "0x7837499d6f32fae0264f3fe8864995d26c65b300",
  entryPoint: "0x0000000000000000000000000000000000000000",
  factory: "0x600d0a6c8A3067BCe9D1bB089914ABC2c45C9E6C",
  policy: "0x073fE1166748ea8c5cE304e1AE0a6319EDE5e108",
  preflightRegistry: "0x25D40008ffC27D95D506224a246916d7E7ac0f36",
  riskRegistry: "0xC0495a933C41Fd7c32Dd674c1983Ab6f95e58E08",
  reputation: "0xc4EAa1d5F94Ee779EE48Ca1E8f1246d29dF07C6f",
  riskyVault: "0x724F821E3923004e9e33281248c68895680D2666",
  safeVault: "0x9e621f3959883050cA21cdb084DDf83C37fB8407",
  smartWalletRegistry: "0x3959F427883faD713C5F533A762A83dDbF1b86fD",
  volatileVault: "0xdAe906ae41d2ECfAEF72835fF8A65672D40F27bf",
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
