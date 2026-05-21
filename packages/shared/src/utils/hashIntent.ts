import {
  encodeFunctionData,
  isAddress,
  keccak256,
  maxUint256,
  parseUnits,
  toBytes,
} from "viem";
import type {
  CreateTransactionIntentInput,
  TransactionIntent,
  TransactionIntentKind,
} from "../types/TransactionIntent";

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function canonicalIntent(intent: Omit<TransactionIntent, "intentHash">) {
  return JSON.stringify({
    agentId: intent.agentId,
    amount: intent.amount,
    amountBaseUnits: intent.amountBaseUnits,
    calldata: intent.calldata,
    chainId: intent.chainId,
    kind: intent.kind,
    summary: intent.summary,
    target: intent.target.toLowerCase(),
    tokenAddress: intent.tokenAddress.toLowerCase(),
    tokenDecimals: intent.tokenDecimals,
    tokenSymbol: intent.tokenSymbol,
  });
}

export function hashIntent(intent: Omit<TransactionIntent, "intentHash">) {
  return keccak256(toBytes(canonicalIntent(intent)));
}

function parseTask(task: string): {
  kind: TransactionIntentKind;
  amount: string;
  target: `0x${string}`;
} {
  const normalizedTask = task.trim();
  const addressMatch = normalizedTask.match(/0x[a-fA-F0-9]{40}/);
  const amountMatch = normalizedTask.match(
    /(?:send|approve)\s+([0-9]+(?:\.[0-9]+)?|unlimited)/i,
  );

  if (!addressMatch || !isAddress(addressMatch[0])) {
    throw new Error("Enter a valid target address.");
  }

  if (!amountMatch) {
    throw new Error("Enter an amount, such as 10 USDC.");
  }

  const kind = /^approve/i.test(normalizedTask)
    ? "erc20_approval"
    : /^send/i.test(normalizedTask)
      ? "erc20_transfer"
      : undefined;

  if (!kind) {
    throw new Error("Start the task with Send or Approve.");
  }

  return {
    amount: amountMatch[1],
    kind,
    target: addressMatch[0] as `0x${string}`,
  };
}

export function createTransactionIntent(
  input: CreateTransactionIntentInput,
): TransactionIntent {
  if (!isAddress(input.tokenAddress)) {
    throw new Error("Enter a valid token address.");
  }

  const tokenSymbol = input.tokenSymbol ?? "USDC";
  const tokenDecimals = input.tokenDecimals ?? 6;
  const parsedTask = parseTask(input.task);
  const amountBaseUnits =
    parsedTask.amount.toLowerCase() === "unlimited"
      ? maxUint256
      : parseUnits(parsedTask.amount, tokenDecimals);

  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName:
      parsedTask.kind === "erc20_transfer" ? "transfer" : "approve",
    args: [parsedTask.target, amountBaseUnits],
  });

  const summary =
    parsedTask.kind === "erc20_transfer"
      ? `Send ${parsedTask.amount} ${tokenSymbol} to ${parsedTask.target}`
      : `Approve ${parsedTask.amount} ${tokenSymbol} for ${parsedTask.target}`;

  const intentWithoutHash = {
    agentId: input.agentId,
    amount: parsedTask.amount,
    amountBaseUnits: amountBaseUnits.toString(),
    calldata,
    chainId: input.chainId,
    kind: parsedTask.kind,
    summary,
    target: parsedTask.target,
    tokenAddress: input.tokenAddress,
    tokenDecimals,
    tokenSymbol,
  } satisfies Omit<TransactionIntent, "intentHash">;

  return {
    ...intentWithoutHash,
    intentHash: hashIntent(intentWithoutHash),
  };
}
