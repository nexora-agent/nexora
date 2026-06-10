export type RecordedMantleProofs = {
  agentId?: string;
  smartWallet?: string;
  benchmarkRegistry?: string;
  validationTx?: string;
  executionTx?: string;
  reputationTx?: string;
  reportHash?: string;
};

function trimmed(value: string | undefined) {
  const result = value?.trim();
  return result ? result : undefined;
}

export function getMantleExplorerBaseUrl() {
  return (
    trimmed(process.env.NEXT_PUBLIC_MANTLE_EXPLORER_URL) ??
    "https://explorer.sepolia.mantle.xyz"
  ).replace(/\/+$/, "");
}

export function explorerAddressUrl(address: string) {
  return `${getMantleExplorerBaseUrl()}/address/${address}`;
}

export function explorerTxUrl(txHash: string) {
  return `${getMantleExplorerBaseUrl()}/tx/${txHash}`;
}

export function getRecordedMantleProofs(): RecordedMantleProofs {
  return {
    agentId: trimmed(process.env.NEXT_PUBLIC_DEMO_AGENT_ID),
    benchmarkRegistry: trimmed(process.env.NEXT_PUBLIC_DEMO_BENCHMARK_REGISTRY),
    executionTx: trimmed(process.env.NEXT_PUBLIC_DEMO_EXECUTION_TX),
    reportHash: trimmed(process.env.NEXT_PUBLIC_DEMO_REPORT_HASH),
    reputationTx: trimmed(process.env.NEXT_PUBLIC_DEMO_REPUTATION_TX),
    smartWallet: trimmed(process.env.NEXT_PUBLIC_DEMO_SMART_WALLET),
    validationTx: trimmed(process.env.NEXT_PUBLIC_DEMO_VALIDATION_TX),
  };
}

export function hasAnyRecordedProof(proofs: RecordedMantleProofs) {
  return Object.values(proofs).some(Boolean);
}
