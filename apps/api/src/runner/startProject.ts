import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import {
  createLocalExecutorKey,
  executorKeyInfo,
  repoRoot,
  type ExecutorKeyInfo,
} from "./executorKeyStore.js";

function loadEnvFile() {
  const envPath = resolve(repoRoot, ".env");

  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function ensureExecutorKey() {
  loadEnvFile();

  let info = executorKeyInfo();

  if (info.privateKey) {
    return info;
  }

  console.log("No local executor key found.");

  if (!process.stdin.isTTY) {
    info = createLocalExecutorKey();
    console.log(`Created local executor key at ${info.keyPath}`);
    return info;
  }

  const rl = createInterface({ input, output });

  try {
    const answer = (
      await rl.question(
        "Paste an existing executor private key, or press Enter to generate a new local key: ",
      )
    ).trim();

    info = createLocalExecutorKey(answer || undefined);
    console.log(`Created local executor key at ${info.keyPath}`);
    return info;
  } finally {
    rl.close();
  }
}

function printExecutorInfo(info: ExecutorKeyInfo) {
  console.log("");
  console.log("Nexora local executor");
  console.log(`Address: ${info.address ?? "not configured"}`);
  console.log(
    `Key source: ${
      info.source === "env"
        ? ".env NEXORA_AGENT_EXECUTOR_PRIVATE_KEY"
        : info.source === "local-file"
          ? info.keyPath
          : "missing"
    }`,
  );
  console.log("Private key: local only, never sent to the browser");
  console.log("");
}

async function main() {
  const setupOnly = process.argv.includes("--setup-only");
  const info = await ensureExecutorKey();

  printExecutorInfo(info);

  if (setupOnly) {
    return;
  }

  if (!info.privateKey) {
    throw new Error("Executor private key is still missing.");
  }

  const child = spawn("pnpm", ["--parallel", "dev"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NEXORA_AGENT_EXECUTOR_PRIVATE_KEY: info.privateKey,
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
