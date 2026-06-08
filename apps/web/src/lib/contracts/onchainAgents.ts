import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentIdentityAbi,
  nexoraFactoryAbi,
} from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

export type OnchainAgentRegistration = {
  agentId: string;
  transactionHash: `0x${string}`;
};

export type OnchainAgentWallet = {
  walletAddress: `0x${string}`;
  transactionHash?: `0x${string}`;
};

export async function registerAgentIdentityOnchain(
  metadataUri: string,
): Promise<OnchainAgentRegistration> {
  if (isNexoraMockWallet()) {
    throw new Error("Nexora mock wallet uses demo writes.");
  }

  const nextAgentId = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.agentIdentity,
    abi: nexoraAgentIdentityAbi,
    functionName: "nextAgentId",
    chainId: mantleSepolia.id,
  });

  const resolvedMetadataUri = metadataUri.replace(
    "{agentId}",
    nextAgentId.toString(),
  );

  const transactionHash = await writeContract(wagmiConfig, {
    address: mantleSepoliaContracts.agentIdentity,
    abi: nexoraAgentIdentityAbi,
    functionName: "registerAgent",
    args: [resolvedMetadataUri],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  return {
    agentId: nextAgentId.toString(),
    transactionHash,
  };
}

export async function createAgentWalletOnchain(
  agentId: string,
): Promise<OnchainAgentWallet> {
  if (isNexoraMockWallet()) {
    throw new Error("Nexora mock wallet uses demo writes.");
  }

  const parsedAgentId = BigInt(agentId);
  const existingWallet = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.factory,
    abi: nexoraFactoryAbi,
    functionName: "walletOfAgent",
    args: [parsedAgentId],
    chainId: mantleSepolia.id,
  });

  if (existingWallet !== zeroAddress) {
    return {
      walletAddress: existingWallet as Address,
    };
  }

  const transactionHash = await writeContract(wagmiConfig, {
    address: mantleSepoliaContracts.factory,
    abi: nexoraFactoryAbi,
    functionName: "createAgentWallet",
    args: [parsedAgentId],
    chainId: mantleSepolia.id,
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet.");
  }

  await waitForTransactionReceipt(wagmiConfig, {
    hash: transactionHash,
    chainId: mantleSepolia.id,
  });

  const walletAddress = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.factory,
    abi: nexoraFactoryAbi,
    functionName: "walletOfAgent",
    args: [parsedAgentId],
    chainId: mantleSepolia.id,
  });

  return {
    walletAddress: walletAddress as Address,
    transactionHash,
  };
}

export function shouldFallbackToDemoWrite(caughtError: unknown) {
  const message =
    caughtError instanceof Error ? caughtError.message.toLowerCase() : "";

  if (message.includes("user rejected") || message.includes("user denied")) {
    return false;
  }

  return (
    message.includes("hash") ||
    message.includes("request") ||
    message.includes("connector") ||
    message.includes("no data") ||
    message.includes("address is not a contract") ||
    message.includes("does not have the function") ||
    message.includes("wallet client") ||
    message.includes("mock wallet") ||
    message.includes("demo writes") ||
    message.includes("null")
  );
}

export function isNexoraMockWallet() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (window as Window & { ethereum?: { isNexoraMock?: boolean } }).ethereum
      ?.isNexoraMock,
  );
}

export type OnchainAgentIdentitySummary = {
  agentId: string;
  smartWalletAddress?: `0x${string}`;
};

export async function readAgentIdentitySummaryOnchain(
  agentId: string,
): Promise<OnchainAgentIdentitySummary> {
  const parsedAgentId = BigInt(agentId);

  const walletAddress = await readContract(wagmiConfig, {
    address: mantleSepoliaContracts.factory,
    abi: nexoraFactoryAbi,
    functionName: "walletOfAgent",
    args: [parsedAgentId],
    chainId: mantleSepolia.id,
  });

  return {
    agentId,
    smartWalletAddress:
      walletAddress && walletAddress !== zeroAddress
        ? (walletAddress as `0x${string}`)
        : undefined,
  };
}
