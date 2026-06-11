import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type ExecutorKeySource = "env" | "local-file" | "missing";

export type ExecutorKeyInfo = {
  address?: Address;
  createdAt?: string;
  keyPath: string;
  privateKey?: Hex;
  source: ExecutorKeySource;
};

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const executorKeyPath = resolve(repoRoot, ".nexora/keys/executor.local.json");

type StoredExecutorKey = {
  address?: string;
  createdAt?: string;
  privateKey?: string;
};

export function normalizePrivateKey(value: string): Hex {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error("Executor private key must be a 32-byte hex string.");
  }

  return prefixed as Hex;
}

function infoFromPrivateKey(privateKey: Hex, source: ExecutorKeySource, createdAt?: string) {
  return {
    address: getAddress(privateKeyToAccount(privateKey).address),
    createdAt,
    keyPath: executorKeyPath,
    privateKey,
    source,
  } satisfies ExecutorKeyInfo;
}

export function executorKeyInfo(): ExecutorKeyInfo {
  const envPrivateKey = process.env.NEXORA_AGENT_EXECUTOR_PRIVATE_KEY?.trim();

  if (envPrivateKey) {
    return infoFromPrivateKey(normalizePrivateKey(envPrivateKey), "env");
  }

  if (!existsSync(executorKeyPath)) {
    return { keyPath: executorKeyPath, source: "missing" };
  }

  const stored = JSON.parse(readFileSync(executorKeyPath, "utf8")) as StoredExecutorKey;

  if (!stored.privateKey) {
    return { keyPath: executorKeyPath, source: "missing" };
  }

  return infoFromPrivateKey(
    normalizePrivateKey(stored.privateKey),
    "local-file",
    stored.createdAt,
  );
}

export function requiredExecutorPrivateKey(): Hex {
  const info = executorKeyInfo();

  if (!info.privateKey) {
    throw new Error(
      `Executor key not configured. Run "pnpm start:project" to create ${executorKeyPath}, or set NEXORA_AGENT_EXECUTOR_PRIVATE_KEY in .env.`,
    );
  }

  return info.privateKey;
}

export function createLocalExecutorKey(privateKeyInput?: string): ExecutorKeyInfo {
  const privateKey = privateKeyInput
    ? normalizePrivateKey(privateKeyInput)
    : generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const createdAt = new Date().toISOString();

  mkdirSync(dirname(executorKeyPath), { recursive: true });
  writeFileSync(
    executorKeyPath,
    `${JSON.stringify(
      {
        address: getAddress(account.address),
        createdAt,
        privateKey,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  try {
    chmodSync(executorKeyPath, 0o600);
  } catch {
    // Best effort on filesystems that do not support chmod.
  }

  return infoFromPrivateKey(privateKey, "local-file", createdAt);
}
