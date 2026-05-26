import { mkdir, readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";

export type LocalHarnessRunLogEntry = {
  agentId?: string;
  createdAt: string;
  endpointHost: string;
  error?: string;
  harnessId: string;
  latencyMs: number;
  objective: string;
  requestHash: string;
  responseHash?: string;
  runId: string;
  status: "success" | "error";
  toolCount: number;
  usedTools: string[];
};

const logDirectory = join(process.cwd(), ".nexora");
const logPath = join(logDirectory, "local-harness-runs.jsonl");

export async function appendLocalHarnessRunLog(entry: LocalHarnessRunLogEntry) {
  await mkdir(logDirectory, { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readLocalHarnessRunLogs(limit = 25) {
  try {
    const raw = await readFile(logPath, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line) as LocalHarnessRunLogEntry);
  } catch {
    return [];
  }
}
