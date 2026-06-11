import type {
  AgentRecord,
  ObjectiveRun,
  PreflightCredential,
  PreflightThresholds,
} from "@nexora/shared";
import { getBalance, readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { mantleSepolia } from "@/lib/chains/mantle";
import {
  nexoraAgentValidationRegistryAbi,
  nexoraAgentWalletAbi,
  nexoraPreflightRegistryAbi,
} from "@/lib/contracts/abis";
import { mantleSepoliaContracts } from "@/lib/contracts/deployments";
import { wagmiConfig } from "@/lib/wagmi/config";

const preflightThresholdCache = new Map<
  string,
  { exists?: boolean; expiresAt: number; thresholds: PreflightThresholds }
>();
let nextRpcSlotAt = 0;

function delay(milliseconds: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function waitForRpcSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, nextRpcSlotAt - now);
  nextRpcSlotAt = Math.max(now, nextRpcSlotAt) + 450;

  if (waitMs > 0) {
    await delay(waitMs);
  }
}

function isRateLimitError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

function isTransactionNotIndexedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("could not be found") ||
    error.message.includes("TransactionNotFound") ||
    error.message.includes("transaction not found")
  );
}

function normalizeTransactionError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  const message = error.message;

  if (
    message.includes("User denied") ||
    message.includes("user rejected") ||
    message.includes("4001")
  ) {
    return new Error("Transaction was cancelled in MetaMask.");
  }

  if (message.includes("nonce too low")) {
    return new Error(
      "Wallet nonce was out of sync. Wait a few seconds, refresh the page, then try the test transaction again.",
      { cause: error },
    );
  }

  const knownErrors: Array<[string, string]> = [
    [
      "NotSmartWalletOwner",
      "Only the owner wallet can save preflight settings for this smart wallet.",
    ],
    [
      "NotAgentOwner",
      "Only the owner wallet can save validation settings for this agent identity.",
    ],
    [
      "NotAuthorizedReporter",
      "This executor is not authorized to publish validation proofs for the agent.",
    ],
    ["InvalidScore", "Preflight settings must use scores from 0 to 100 and a non-zero freshness window."],
    ["MissingIntentHash", "Preflight could not be published because the action intent hash is missing."],
    ["PreflightAlreadyRecorded", "This preflight proof was already published. Run the benchmark again to create a fresh proof."],
    ["PreflightNotFound", "Execution could not find the published preflight proof on Mantle."],
    ["ValidationAlreadyRecorded", "This validation proof was already published. Run the benchmark again to create a fresh proof."],
    ["ValidationNotFound", "Execution could not find the published validation proof on Mantle."],
    ["NotOwner", "Only the smart wallet owner can execute this action."],
    ["ExecutionFailed", "The smart wallet transaction failed. Check that the smart wallet has enough MNT and that the target vault accepts the call."],
    ["IntentMismatch", "Execution blocked because the action intent does not match the preflight proof."],
    ["PreflightWalletMismatch", "Execution blocked because the preflight proof belongs to a different smart wallet."],
    ["PreflightFailed", "Execution blocked because the published preflight proof did not pass."],
    ["PreflightStale", "Execution blocked because the preflight proof is stale. Run preflight again."],
    ["PreflightScoreTooLow", "Execution blocked because the on-chain preflight scores are below the active thresholds."],
    ["RiskTooHigh", "Execution blocked because the action risk score is above the active preflight risk ceiling."],
  ];

  const decodedError = knownErrors.find(([name]) => message.includes(name));
  if (decodedError) {
    return new Error(decodedError[1], { cause: error });
  }

  return error;
}

async function withRpcRetry<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await waitForRpcSlot();

    try {
      return await operation();
    } catch (caughtError) {
      const normalizedError = normalizeTransactionError(caughtError);

      if (!isRateLimitError(normalizedError)) {
        throw normalizedError;
      }

      lastError = normalizedError;
      await delay(1_200 * 2 ** attempt + Math.floor(Math.random() * 350));
    }
  }

  throw new Error(
    `${label} is being rate-limited by Mantle RPC. Wait a few seconds and try again.`,
    { cause: lastError },
  );
}

async function waitForMantleReceipt(
  hash: `0x${string}`,
  label: string,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const receipt = await withRpcRetry(label, () =>
        waitForTransactionReceipt(wagmiConfig, {
          hash,
          chainId: mantleSepolia.id,
          timeout: 120_000,
        }),
      );

      if (receipt.status === "reverted") {
        throw new Error(
          `${label} reverted on Mantle. Check the smart wallet balance, active thresholds, and target vault before trying again.`,
        );
      }

      return receipt;
    } catch (caughtError) {
      const normalizedError = normalizeTransactionError(caughtError);

      if (
        !isTransactionNotIndexedError(normalizedError) &&
        !isRateLimitError(normalizedError)
      ) {
        throw normalizedError;
      }

      lastError = normalizedError;
      await delay(1_500 + attempt * 1_000);
    }
  }

  throw new Error(
    `${label} was submitted, but Mantle has not indexed the receipt yet. Transaction: ${hash}`,
    { cause: lastError },
  );
}

function executionCallForRun(run: ObjectiveRun): {
  target: Address;
  value: bigint;
  data: `0x${string}`;
} {
  if (!run.intent) {
    throw new Error("Execution requires an intent.");
  }

  if (run.intent.kind === "mnt_vault_deposit") {
    return {
      data: run.intent.calldata,
      target: run.intent.target,
      value: BigInt(run.intent.amountBaseUnits),
    };
  }

  if (run.intent.kind === "mnt_vault_withdraw") {
    return {
      data: run.intent.calldata,
      target: run.intent.target,
      value: 0n,
    };
  }

  if (run.intent.kind === "erc20_approval" || run.intent.kind === "erc20_transfer") {
    return {
      data: run.intent.calldata,
      target: run.intent.tokenAddress,
      value: 0n,
    };
  }

  throw new Error("This proposal type is External DeFi Preview only and cannot be executed.");
}

function requirePreflightRegistry() {
  if (
    mantleSepoliaContracts.preflightRegistry.toLowerCase() ===
    zeroAddress.toLowerCase()
  ) {
    throw new Error("Deploy NexoraPreflightRegistry before publishing preflight proofs.");
  }

  return mantleSepoliaContracts.preflightRegistry;
}

function requireAgentValidationRegistry() {
  if (
    mantleSepoliaContracts.agentValidationRegistry.toLowerCase() ===
    zeroAddress.toLowerCase()
  ) {
    throw new Error("Deploy NexoraAgentValidationRegistry before using agent validation proofs.");
  }

  return mantleSepoliaContracts.agentValidationRegistry;
}

export async function recordPreflightOnchain(
  credential: PreflightCredential,
  options: { useAgentValidation?: boolean } = {},
) {
  if (options.useAgentValidation) {
    const registryAddress = requireAgentValidationRegistry();
    await waitForRpcSlot();
    const transactionHash = await writeContract(wagmiConfig, {
      address: registryAddress,
      abi: nexoraAgentValidationRegistryAbi,
      functionName: "recordValidation",
      args: [
        {
          actionIntentHash: credential.actionIntentHash,
          adversarialScore: credential.adversarialScore,
          averageScore: credential.averageScore,
          basicScore: credential.basicScore,
          externalScore: credential.externalScore,
          harnessHash: credential.harnessHash,
          maxRiskScore: credential.maxRiskScore,
          modelHash: credential.modelHash,
          passed: credential.passed,
          policyHash: credential.policyHash,
          reportHash: credential.suiteHash,
          suiteHash: credential.suiteHash,
          toolsHash: credential.toolsHash,
          agentId: BigInt(credential.walletId),
        },
      ],
      chainId: mantleSepolia.id,
    }).catch((caughtError: unknown) => {
      throw normalizeTransactionError(caughtError);
    });

    if (!transactionHash) {
      throw new Error("No transaction hash returned from validation registry.");
    }

    await waitForMantleReceipt(transactionHash, "Validation proof");
    return transactionHash;
  }

  const registryAddress = requirePreflightRegistry();
  await waitForRpcSlot();
  const transactionHash = await writeContract(wagmiConfig, {
    address: registryAddress,
    abi: nexoraPreflightRegistryAbi,
    functionName: "recordPreflight",
    args: [
      {
        actionIntentHash: credential.actionIntentHash,
        adversarialScore: credential.adversarialScore,
        averageScore: credential.averageScore,
        basicScore: credential.basicScore,
        externalScore: credential.externalScore,
        harnessHash: credential.harnessHash,
        maxRiskScore: credential.maxRiskScore,
        modelHash: credential.modelHash,
        passed: credential.passed,
        policyHash: credential.policyHash,
        suiteHash: credential.suiteHash,
        toolsHash: credential.toolsHash,
        walletId: BigInt(credential.walletId),
      },
    ],
    chainId: mantleSepolia.id,
  }).catch((caughtError: unknown) => {
    throw normalizeTransactionError(caughtError);
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from preflight registry.");
  }

  await waitForMantleReceipt(transactionHash, "Preflight proof");

  return transactionHash;
}

export async function executeRunWithPreflightOnchain(
  agent: AgentRecord,
  run: ObjectiveRun,
  credential: PreflightCredential,
) {
  const registryAddress = requirePreflightRegistry();

  if (!agent.walletAddress) {
    throw new Error("Create a smart wallet before execution.");
  }
  const walletAddress = agent.walletAddress;

  if (!run.intent || !run.riskReport) {
    throw new Error("Execution requires an intent and risk report.");
  }

  const executionCall = executionCallForRun(run);
  if (executionCall.value > 0n) {
    const balance = await withRpcRetry("Smart wallet balance", () =>
      getBalance(wagmiConfig, {
        address: walletAddress,
        chainId: mantleSepolia.id,
      }),
    );

    if (balance.value < executionCall.value) {
      throw new Error(
        `Smart wallet needs at least ${run.intent.amount} MNT for this test vault transaction. Current smart wallet balance is ${balance.formatted} MNT.`,
      );
    }
  }

  await waitForRpcSlot();
  const transactionHash = await writeContract(wagmiConfig, {
    address: walletAddress,
    abi: nexoraAgentWalletAbi,
    functionName: "executeWithPreflight",
    args: [
      registryAddress,
      executionCall.target,
      executionCall.value,
      executionCall.data,
      credential.actionIntentHash,
      run.riskReport.riskScore,
    ],
    chainId: mantleSepolia.id,
  }).catch((caughtError: unknown) => {
    throw normalizeTransactionError(caughtError);
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from wallet execution.");
  }

  await waitForMantleReceipt(transactionHash, "Preflight execution");

  return transactionHash;
}

export async function savePreflightThresholdsOnchain(
  walletId: string,
  thresholds: PreflightThresholds,
  options: { useAgentValidation?: boolean } = {},
) {
  if (options.useAgentValidation) {
    const registryAddress = requireAgentValidationRegistry();
    await waitForRpcSlot();
    const transactionHash = await writeContract(wagmiConfig, {
      address: registryAddress,
      abi: nexoraAgentValidationRegistryAbi,
      functionName: "setThresholds",
      args: [
        BigInt(walletId),
        thresholds.basicSafetyMinScore,
        thresholds.adversarialYieldTrapMinScore,
        thresholds.externalDefiReadinessMinScore,
        thresholds.averageMinScore,
        thresholds.maxRiskScore,
        thresholds.freshnessMinutes * 60,
      ],
      chainId: mantleSepolia.id,
    }).catch((caughtError: unknown) => {
      throw normalizeTransactionError(caughtError);
    });

    if (!transactionHash) {
      throw new Error("No transaction hash returned from validation settings.");
    }

    await waitForMantleReceipt(transactionHash, "Validation settings");
    preflightThresholdCache.set(`agent:${walletId}`, {
      exists: true,
      expiresAt: Date.now() + 30_000,
      thresholds,
    });

    return transactionHash;
  }

  const registryAddress = requirePreflightRegistry();
  await waitForRpcSlot();
  const transactionHash = await writeContract(wagmiConfig, {
    address: registryAddress,
    abi: nexoraPreflightRegistryAbi,
    functionName: "setPreflightThresholds",
    args: [
      BigInt(walletId),
      thresholds.basicSafetyMinScore,
      thresholds.adversarialYieldTrapMinScore,
      thresholds.externalDefiReadinessMinScore,
      thresholds.averageMinScore,
      thresholds.maxRiskScore,
      thresholds.freshnessMinutes * 60,
    ],
    chainId: mantleSepolia.id,
  }).catch((caughtError: unknown) => {
    throw normalizeTransactionError(caughtError);
  });

  if (!transactionHash) {
    throw new Error("No transaction hash returned from preflight settings.");
  }

  await waitForMantleReceipt(transactionHash, "Preflight settings");
  preflightThresholdCache.set(walletId, {
    exists: true,
    expiresAt: Date.now() + 30_000,
    thresholds,
  });

  return transactionHash;
}

export async function readPreflightThresholdsOnchain(
  walletId: string,
  options: { skipCache?: boolean; useAgentValidation?: boolean } = {},
) {
  const state = await readPreflightThresholdStateOnchain(walletId, options);
  return state.thresholds;
}

export async function readPreflightThresholdStateOnchain(
  walletId: string,
  options: { skipCache?: boolean; useAgentValidation?: boolean } = {},
) {
  const cacheKey = options.useAgentValidation ? `agent:${walletId}` : walletId;
  const cached = preflightThresholdCache.get(cacheKey);
  if (!options.skipCache && cached && cached.expiresAt > Date.now()) {
    return {
      exists: Boolean(cached.exists),
      source: options.useAgentValidation
        ? "agent-validation"
        : "preflight-registry",
      thresholds: cached.thresholds,
    } as const;
  }

  if (options.useAgentValidation) {
    const registryAddress = requireAgentValidationRegistry();
    const result = await withRpcRetry("Validation settings read", () =>
      readContract(wagmiConfig, {
        address: registryAddress,
        abi: nexoraAgentValidationRegistryAbi,
        functionName: "getThresholds",
        args: [BigInt(walletId)],
        chainId: mantleSepolia.id,
      }),
    );

    const thresholds = {
      adversarialYieldTrapMinScore: Number(result.adversarialScore),
      averageMinScore: Number(result.averageScore),
      basicSafetyMinScore: Number(result.basicScore),
      externalDefiReadinessMinScore: Number(result.externalScore),
      freshnessMinutes: Math.max(1, Math.round(Number(result.freshnessSeconds) / 60)),
      maxRiskScore: Number(result.maxRiskScore),
      preset: result.exists ? "custom" : "conservative",
    } satisfies PreflightThresholds;

    preflightThresholdCache.set(cacheKey, {
      exists: result.exists,
      expiresAt: Date.now() + 30_000,
      thresholds,
    });

    return {
      exists: result.exists,
      source: "agent-validation",
      thresholds,
    } as const;
  }

  const registryAddress = requirePreflightRegistry();
  const result = await withRpcRetry("Preflight settings read", () =>
    readContract(wagmiConfig, {
      address: registryAddress,
      abi: nexoraPreflightRegistryAbi,
      functionName: "getPreflightThresholds",
      args: [BigInt(walletId)],
      chainId: mantleSepolia.id,
    }),
  );

  const thresholds = {
    adversarialYieldTrapMinScore: Number(result.adversarialScore),
    averageMinScore: Number(result.averageScore),
    basicSafetyMinScore: Number(result.basicScore),
    externalDefiReadinessMinScore: Number(result.externalScore),
    freshnessMinutes: Math.max(1, Math.round(Number(result.freshnessSeconds) / 60)),
    maxRiskScore: Number(result.maxRiskScore),
    preset: result.exists ? "custom" : "conservative",
  } satisfies PreflightThresholds;

  preflightThresholdCache.set(cacheKey, {
    exists: result.exists,
    expiresAt: Date.now() + 30_000,
    thresholds,
  });

  return {
    exists: result.exists,
    source: "preflight-registry",
    thresholds,
  } as const;
}
