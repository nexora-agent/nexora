import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { parseEther } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import { wagmiConfig } from "@/lib/wagmi/config";

export async function fundSmartWallet(
  walletAddress: `0x${string}`,
  amountMnt: string,
) {
  const transactionHash = await sendTransaction(wagmiConfig, {
    chainId: mantleSepolia.id,
    to: walletAddress,
    value: parseEther(amountMnt),
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    chainId: mantleSepolia.id,
    hash: transactionHash,
  });

  return transactionHash;
}
