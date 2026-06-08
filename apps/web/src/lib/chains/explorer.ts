import { mantleSepolia } from "@/lib/chains/mantle";

export function mantleExplorerTxUrl(txHash: string) {
  return `${mantleSepolia.blockExplorers.default.url}/tx/${txHash}`;
}

export function mantleExplorerAddressUrl(address: string) {
  return `${mantleSepolia.blockExplorers.default.url}/address/${address}`;
}
