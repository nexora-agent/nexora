import { zeroAddress } from "viem";

export const mantleSepoliaContracts = {
  agentIdentity: "0xfE84E525441723e2A4710F2eC65f55ADa824Afc5",
  agentIdentityRegistry: "0xb2B46B47487047ACbc48E32Fab1D07700D4e9bb8",
  agent4337WalletFactory: "0x4C44d65c55523A295525225374ddD6a136c4F459",
  agentValidationRegistry: "0x498789B18C7e1e96eaD912c315087660088Da8ed",
  agentReputationRegistry: "0xC3b253C447773F38af15F3e8629A370FadCd945a",
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

export function isAgentWalletDeploymentReady() {
  return [
    mantleSepoliaContracts.agentIdentityRegistry,
    mantleSepoliaContracts.agent4337WalletFactory,
    mantleSepoliaContracts.agentValidationRegistry,
  ].every(hasContractAddress);
}

export function isBundlerReady() {
  return isAgentWalletDeploymentReady() && hasContractAddress(mantleSepoliaContracts.entryPoint);
}
