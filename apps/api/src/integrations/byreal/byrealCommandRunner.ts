import { execFileSync } from "node:child_process";

export function runByrealCommand(command: string, args: string[], timeout = 2500) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
    }).trim();
  } catch {
    return null;
  }
}

export function parseJsonOutput<T>(output: string | null): T | null {
  if (!output) {
    return null;
  }

  try {
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

export function runByrealCommandStrict(command: string, args: string[], timeout = 15000) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  }).trim();
}
