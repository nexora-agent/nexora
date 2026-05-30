import { zeroAddress } from "viem";

export const mantleSepoliaContracts = {
  agentIdentity: "0xfE84E525441723e2A4710F2eC65f55ADa824Afc5",
  agentIdentityV2: "0x6abc04a3768BA2f50AEE7b58F4456f2287f2C118",
  agent4337WalletFactory: "0x957386D0Bb50C1D0d6BaF1B85887BfC43428c18E",
  agentValidationRegistry: "0x7c8E9df2CC0BB852432170f5bAFa77Ff6B839Da5",
  agentReputationRegistry: "0xe2dff064Dcb5eaa0B02d3815382e5C88A7a7c2Ed",
  entryPoint: "0x0000000000000000000000000000000000000000",
  factory: "0x600d0a6c8A3067BCe9D1bB089914ABC2c45C9E6C",
  policy: "0x073fE1166748ea8c5cE304e1AE0a6319EDE5e108",
  preflightRegistry: "0xeB2D0dEa9C72Ff5A212ef37e948eec760096c829",
  riskRegistry: "0xC0495a933C41Fd7c32Dd674c1983Ab6f95e58E08",
  reputation: "0xc4EAa1d5F94Ee779EE48Ca1E8f1246d29dF07C6f",
  riskyVault: "0x4a13f61f9cD32a7F9dc04210632018b2D8060397",
  safeVault: "0x705ef09F3C4E28B0028Ae9a76fad558f48f3c22A",
  smartWalletRegistry: "0x3959F427883faD713C5F533A762A83dDbF1b86fD",
  volatileVault: "0xd3510f6f50374e40E1c9eE0C5C9b61AD753d3889",
} as const;

function hasContractAddress(address: string) {
  return address.toLowerCase() !== zeroAddress.toLowerCase();
}

export function isV2DeploymentReady() {
  return [
    mantleSepoliaContracts.agentIdentityV2,
    mantleSepoliaContracts.agent4337WalletFactory,
    mantleSepoliaContracts.agentValidationRegistry,
  ].every(hasContractAddress);
}

export function isV2BundlerReady() {
  return isV2DeploymentReady() && hasContractAddress(mantleSepoliaContracts.entryPoint);
}

