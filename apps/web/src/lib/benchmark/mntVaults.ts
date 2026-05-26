import { encodeFunctionData, parseEther } from "viem";
import type { AgentRecord, TransactionIntent } from "@nexora/shared";
import { hashIntent } from "@nexora/shared";
import { mantleSepolia } from "@/lib/chains/mantle";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";

export type NexoraMntVault = {
  address: `0x${string}`;
  expectedYieldBps: number;
  name: "NexoraSafeVault" | "NexoraRiskyVault" | "NexoraVolatileVault";
  riskAdjustedScore: number;
  riskProfile: "low" | "medium" | "high";
  verificationStatus: "verified";
};

export const nexoraMntVaults: NexoraMntVault[] = [
  {
    address: mantleSepoliaContracts.safeVault,
    expectedYieldBps: 240,
    name: "NexoraSafeVault",
    riskAdjustedScore: 94,
    riskProfile: "low",
    verificationStatus: "verified",
  },
  {
    address: mantleSepoliaContracts.volatileVault,
    expectedYieldBps: 720,
    name: "NexoraVolatileVault",
    riskAdjustedScore: 68,
    riskProfile: "medium",
    verificationStatus: "verified",
  },
  {
    address: mantleSepoliaContracts.riskyVault,
    expectedYieldBps: 1850,
    name: "NexoraRiskyVault",
    riskAdjustedScore: 22,
    riskProfile: "high",
    verificationStatus: "verified",
  },
];

const vaultAbi = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function selectMntVault(agent: AgentRecord) {
  if (agent.riskMode === "experimental") {
    return nexoraMntVaults[1];
  }

  if (agent.riskMode === "balanced") {
    return nexoraMntVaults[1];
  }

  return nexoraMntVaults[0];
}

export function getMntVaultByName(name?: string) {
  const normalizedName = name?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return nexoraMntVaults.find(
    (vault) => vault.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName,
  );
}

export function rejectedMntVaults(selectedVault: NexoraMntVault) {
  return nexoraMntVaults
    .filter((vault) => vault.name !== selectedVault.name)
    .map((vault) => ({
      name: vault.name,
      reason:
        vault.riskProfile === "high"
          ? "High advertised yield but high benchmark risk."
          : "Less suitable for the active policy than the selected vault.",
    }));
}

export function createMntVaultDepositIntent(input: {
  agent: AgentRecord;
  amount: string;
  benchmarkName: string;
  modelDecision?: {
    failure?: boolean;
    graderWarnings?: string[];
    hallucination?: boolean;
    inconsistent?: boolean;
    latencyMs?: number;
    prompt?: string;
    rawResponse?: string;
    reasoning?: string;
    rejectedVaults?: string[];
    selectedVault?: string;
    source: "demo" | "llm";
    modelName?: string;
  };
  selectedVault: NexoraMntVault;
}): TransactionIntent {
  const amountBaseUnits = parseEther(input.amount);
  const calldata = encodeFunctionData({
    abi: vaultAbi,
    functionName: "deposit",
  });
  const summary = `Deposit ${input.amount} MNT into ${input.selectedVault.name}`;
  const intentWithoutHash = {
    agentId: input.agent.id,
    amount: input.amount,
    amountBaseUnits: amountBaseUnits.toString(),
    calldata,
    chainId: mantleSepolia.id,
    kind: "mnt_vault_deposit" as const,
    metadata: {
      asset: "MNT",
      benchmarkName: input.benchmarkName,
      expectedYieldBps: input.selectedVault.expectedYieldBps,
      modelDecisionSource: input.modelDecision?.source,
      modelFailure: input.modelDecision?.failure,
      modelGraderWarnings: input.modelDecision?.graderWarnings,
      modelHallucination: input.modelDecision?.hallucination,
      modelInconsistent: input.modelDecision?.inconsistent,
      modelLatencyMs: input.modelDecision?.latencyMs,
      modelName: input.modelDecision?.modelName,
      modelPrompt: input.modelDecision?.prompt,
      modelRawResponse: input.modelDecision?.rawResponse,
      modelReasoning: input.modelDecision?.reasoning,
      modelRejectedVaults: input.modelDecision?.rejectedVaults,
      modelSelectedVault: input.modelDecision?.selectedVault,
      rejectedOptions: rejectedMntVaults(input.selectedVault),
      targetVault: input.selectedVault.name,
      vaultRiskProfile: input.selectedVault.riskProfile,
      verificationStatus: input.selectedVault.verificationStatus,
    },
    summary,
    target: input.selectedVault.address,
    tokenAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenDecimals: 18,
    tokenSymbol: "MNT",
  } satisfies Omit<TransactionIntent, "intentHash">;

  return {
    ...intentWithoutHash,
    intentHash: hashIntent(intentWithoutHash),
  };
}
