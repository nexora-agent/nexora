import type { ByrealExecutionMode, ByrealMode, ByrealStatus } from "./byrealTypes";
import { runByrealCommand } from "./byrealCommandRunner";

const cliSupportedTools = [
  "get_byreal_status",
  "list_byreal_pools",
  "inspect_byreal_pool",
  "compare_byreal_opportunities",
  "create_byreal_action_intent",
  "analyze_byreal_action_risk",
];

function detectCli() {
  for (const command of ["byreal-cli", "byreal", "realclaw"]) {
    const version = runByrealCommand(command, ["--version"], 1500);
    if (version) {
      return {
        binaryName: command,
        version,
      };
    }
  }

  return {
    binaryName: null,
    version: null,
  };
}

function detectWalletConfigured(binaryName: string | null) {
  if (!binaryName) {
    return false;
  }

  const output = runByrealCommand(binaryName, ["wallet", "address"], 1500);
  return Boolean(output && output.length > 0);
}

export function getByrealStatus(): ByrealStatus {
  const { binaryName, version } = detectCli();
  const installed = Boolean(version);
  const apiBaseUrl = process.env.BYREAL_API_BASE_URL;
  const apiConfigured = Boolean(apiBaseUrl);
  const walletConfigured = detectWalletConfigured(binaryName);
  const liveEnabled = process.env.BYREAL_ENABLE_LIVE_EXECUTION === "true";
  const executionEnabled = Boolean(installed && walletConfigured && liveEnabled);
  const mode: ByrealMode = installed
    ? walletConfigured
      ? executionEnabled
        ? "cli_live"
        : "cli_dry_run"
      : "cli_read_only"
    : apiConfigured
      ? "api_read_only"
      : "demo";
  const executionMode: ByrealExecutionMode =
    mode === "cli_live"
      ? "live"
      : mode === "cli_dry_run"
        ? "dry_run"
        : mode === "demo"
          ? "disabled"
          : "read_only";
  const errors = [];

  if (!installed && !apiConfigured) {
    errors.push("Official Byreal CLI/API not configured. Demo adapter is active.");
  }

  if (installed && !walletConfigured) {
    errors.push("Byreal CLI detected without a configured local wallet. Read-only tools only.");
  }

  if (installed && walletConfigured && !liveEnabled) {
    errors.push("Local Byreal wallet detected. Live execution is still disabled until BYREAL_ENABLE_LIVE_EXECUTION=true.");
  }

  return {
    adapterMode: mode,
    apiBaseUrl,
    apiConfigured,
    binaryName,
    errors,
    executionEnabled,
    executionMode,
    installed,
    lastCheckedAt: new Date().toISOString(),
    mode,
    operatorMessage:
      mode === "demo"
        ? "Demo adapter active. Live execution remains disabled."
        : mode === "api_read_only"
          ? "Byreal API read-only mode active. Live execution remains disabled."
          : mode === "cli_read_only"
            ? "Byreal CLI read-only mode active. Configure a local wallet only for dry-run previews."
            : mode === "cli_dry_run"
              ? "Byreal CLI preview mode available. Set BYREAL_ENABLE_LIVE_EXECUTION=true to allow guarded local execution."
              : "Byreal CLI live execution is enabled locally. Nexora still requires policy gates and operator limits.",
    supportedTools: mode === "demo" ? [] : cliSupportedTools,
    version,
    walletConfigured,
  };
}
