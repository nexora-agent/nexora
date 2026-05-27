import { mapByrealError } from "./byrealErrorMapper";
import { runByrealCommandStrict } from "./byrealCommandRunner";
import { getByrealStatus } from "./byrealStatus";

type ByrealLiveActionKind = "byreal_swap_preview" | "byreal_lp_deposit_preview";

type ByrealLiveExecutionRequest = {
  actionKind: ByrealLiveActionKind;
  amount: string;
  autonomous?: boolean;
  intentHash: `0x${string}`;
  operatorConsent?: string;
  poolId?: string;
  poolName?: string;
};

const consentPhrase = "EXECUTE BYREAL LIVE";

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function templateArgs(template: string, input: ByrealLiveExecutionRequest) {
  return template
    .replaceAll("{{amount}}", input.amount)
    .replaceAll("{{poolId}}", input.poolId ?? "")
    .replaceAll("{{intentHash}}", input.intentHash)
    .split(/\s+/)
    .filter(Boolean);
}

function argsForRequest(input: ByrealLiveExecutionRequest) {
  const template =
    input.actionKind === "byreal_swap_preview"
      ? process.env.BYREAL_LIVE_SWAP_COMMAND_TEMPLATE
      : process.env.BYREAL_LIVE_LP_COMMAND_TEMPLATE;

  if (!template) {
    throw new Error(
      input.actionKind === "byreal_swap_preview"
        ? "BYREAL_LIVE_SWAP_COMMAND_TEMPLATE is required for live swaps."
        : "BYREAL_LIVE_LP_COMMAND_TEMPLATE is required for live LP deposits.",
    );
  }

  return templateArgs(template, input);
}

export function executeByrealLiveAction(input: ByrealLiveExecutionRequest) {
  const status = getByrealStatus();
  const maxAmount = parseAmount(process.env.BYREAL_MAX_LIVE_AMOUNT_MNT ?? "0.01");
  const amount = parseAmount(input.amount);
  const autonomousEnabled = process.env.BYREAL_ENABLE_AUTONOMOUS_EXECUTION === "true";

  if (!status.executionEnabled || status.mode !== "cli_live" || !status.binaryName) {
    return {
      blockedReason:
        "Live Byreal execution is disabled. Configure byreal-cli, a local wallet, and BYREAL_ENABLE_LIVE_EXECUTION=true.",
      executionEnabled: false,
      status,
      success: false,
    };
  }

  if (input.autonomous && !autonomousEnabled) {
    return {
      blockedReason:
        "Autonomous Byreal execution is disabled. Set BYREAL_ENABLE_AUTONOMOUS_EXECUTION=true on the local runner.",
      executionEnabled: true,
      status,
      success: false,
    };
  }

  if (!input.autonomous && input.operatorConsent !== consentPhrase) {
    return {
      blockedReason: `Operator consent is required. Send operatorConsent="${consentPhrase}".`,
      executionEnabled: true,
      status,
      success: false,
    };
  }

  if (!amount || amount > maxAmount) {
    return {
      blockedReason: `Amount ${input.amount} exceeds BYREAL_MAX_LIVE_AMOUNT_MNT=${maxAmount}.`,
      executionEnabled: true,
      status,
      success: false,
    };
  }

  try {
    const args = argsForRequest(input);
    const stdout = runByrealCommandStrict(status.binaryName, args);

    return {
      args,
      autonomous: Boolean(input.autonomous),
      command: status.binaryName,
      executionEnabled: true,
      intentHash: input.intentHash,
      poolId: input.poolId,
      poolName: input.poolName,
      rawOutput: stdout,
      status,
      success: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      blockedReason: mapByrealError(error),
      executionEnabled: true,
      status,
      success: false,
    };
  }
}
