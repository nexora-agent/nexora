import { zeroAddress } from "viem";

export const mantleSepoliaContracts = {
  agentIdentity: "0x098A9C52CA0Ed90e46d56f194ea9625F654271e9",
  agentIdentityRegistry: "0x713B441E7F5176e01e8Bc53E6fCaA5DF02E5cd00",
  agent4337WalletFactory: "0x859c53CB180C974540CcB2F46243071D65dD8Bfb",
  agentValidationRegistry: "0xbf6057526CDa51a636E3f9F6514a5de4f70CEe9c",
  agentReputationRegistry: "0x5F0837535e754090f1e0319A784d3d17f8908fFA",
  benchmarkDex: "0x7A1f965D9fD44926daCBDf89d4407dE4838Dfb75",
  benchmarkRegistry: "0x1a2a650bF7C03f9E4FE55120B0a097dCC7F15d40",
  benchmarkToken: "0x369174a171A09bb738Bb2f645B586cd4e20CF47a",
  entryPoint: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  factory: "0xC9eb069965Be0D51c1ec88375d90AFCb844809F0",
  policy: "0xf00272d4E3822E942AF9FD662977c3D1024e9d74",
  preflightRegistry: "0xF5206fC7B2F2240679058Ad03068898A0e0798De",
  riskRegistry: "0x76e03C2C4FB48186Df4173AE211DD0a1eeE8e95B",
  reputation: "0xf19c410c3C7bDb0AeBd57c48Eb01BDF500D6F2aa",
  riskyVault: "0x0516B1d235e68E5B2384FF1d191d9d3Bd8E50f68",
  safeVault: "0x9dCC52c072ebeC4524EbCbB778CfCbec4121E09f",
  smartWalletRegistry: "0x009D87F661b5CCF9d74e24b61378F1Cf10E3Ff9D",
  volatileVault: "0x9DA588A1d1A77e102131E0302e8c878F82676933",
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
