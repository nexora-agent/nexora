import {
  type ByrealStatus,
  byrealSupportedTools,
  getByrealStatus,
} from "./byrealAdapter";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_NEXORA_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

function normalizeStatus(status: Partial<ByrealStatus>): ByrealStatus {
  const fallback = getByrealStatus();
  const mode = status.mode ?? status.adapterMode ?? fallback.mode;

  return {
    ...fallback,
    ...status,
    adapterMode: status.adapterMode ?? mode,
    apiConfigured: Boolean(status.apiConfigured),
    binaryName: status.binaryName ?? null,
    executionEnabled: false,
    executionMode:
      status.executionMode ??
      (mode === "cli_dry_run"
        ? "dry_run"
        : mode === "cli_read_only" || mode === "api_read_only"
          ? "read_only"
          : "disabled"),
    installed: Boolean(status.installed),
    lastCheckedAt: status.lastCheckedAt ?? fallback.lastCheckedAt,
    mode,
    operatorMessage: status.operatorMessage ?? fallback.operatorMessage,
    supportedTools:
      status.supportedTools?.length || mode !== "demo"
        ? (status.supportedTools ?? byrealSupportedTools)
        : [],
    version: status.version ?? null,
    walletConfigured: Boolean(status.walletConfigured),
  };
}

export async function fetchByrealStatus(): Promise<ByrealStatus> {
  try {
    const response = await fetch(`${apiBaseUrl}/integrations/byreal/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Byreal status request failed: ${response.status}`);
    }

    return normalizeStatus((await response.json()) as Partial<ByrealStatus>);
  } catch (error) {
    const fallback = getByrealStatus();
    return {
      ...fallback,
      errors: [
        ...fallback.errors,
        error instanceof Error ? error.message : "Unable to load Byreal status.",
      ],
    };
  }
}
