export type ByrealMode =
  | "demo"
  | "api_read_only"
  | "cli_read_only"
  | "cli_dry_run"
  | "cli_live"
  | "disabled";
export type ByrealExecutionMode = "read_only" | "dry_run" | "live" | "disabled";

export type ByrealStatus = {
  mode: ByrealMode;
  adapterMode: ByrealMode;
  apiBaseUrl?: string;
  apiConfigured: boolean;
  binaryName: string | null;
  installed: boolean;
  lastCheckedAt: string;
  operatorMessage: string;
  version: string | null;
  walletConfigured: boolean;
  supportedTools: string[];
  executionEnabled: boolean;
  executionMode: ByrealExecutionMode;
  errors: string[];
};

export type ByrealPool = {
  id: string;
  name: string;
  pair: string;
  address: `0x${string}`;
  tvlUsd: number;
  aprBps: number;
  volatility: "low" | "medium" | "high";
  riskHints: string[];
};

export type ByrealOverview = {
  mode: ByrealMode;
  poolCount: number;
  executionMode: ByrealExecutionMode;
  executionEnabled: boolean;
  liveExecutionEnabled: boolean;
  operatorMessage: string;
};

export type ByrealToolOutput<TInput = unknown, TResult = unknown> = {
  toolName: string;
  mode: ByrealMode;
  adapterMode: ByrealMode;
  source: "Byreal / RealClaw";
  input: TInput;
  result: TResult;
  riskHints: string[];
  executionMode: ByrealExecutionMode;
  timestamp: string;
};
