import type { RiskReport, ToolTraceEntry } from "@nexora/shared";
import { getTool } from "../mcp/toolRegistry";
import type { ToolContext, ToolExecutionState, ToolInput } from "../mcp/toolTypes";

function actionToolForTask(task: string) {
  const normalizedTask = task.toLowerCase();

  return normalizedTask.includes("approve") || normalizedTask.includes("approval")
    ? "create_approval_intent"
    : "create_transfer_intent";
}

export function runToolLoop(context: ToolContext, input: ToolInput) {
  const state: ToolExecutionState = {};
  const toolTrace: ToolTraceEntry[] = [];
  const toolNames =
    context.harnessId === "byreal-defi"
      ? [
          "get_agent_profile",
          "get_harness_config",
          "get_byreal_pools",
          "inspect_byreal_pool",
          "create_byreal_swap_intent",
          "analyze_byreal_action_risk",
        ]
      : [
          "get_agent_profile",
          "get_harness_config",
          "get_wallet_balance",
          actionToolForTask(input.task ?? ""),
          "analyze_risk",
        ];
  let report: RiskReport | undefined;

  for (const toolName of toolNames) {
    const tool = getTool(toolName);

    if (!tool || !tool.harnessIds.includes(context.harnessId)) {
      toolTrace.push({
        index: toolTrace.length + 1,
        status: "error",
        summary: `${toolName} is not available for ${context.harnessId}.`,
        toolName,
      });
      continue;
    }

    try {
      const result = tool.execute(context, input, state);
      if (
        (toolName === "analyze_risk" ||
          toolName === "analyze_byreal_action_risk") &&
        result.data
      ) {
        report = result.data as RiskReport;
      }

      toolTrace.push({
        index: toolTrace.length + 1,
        status: "success",
        summary: result.summary,
        toolName,
      });
    } catch (error) {
      toolTrace.push({
        index: toolTrace.length + 1,
        status: "error",
        summary: error instanceof Error ? error.message : "Tool failed.",
        toolName,
      });
    }
  }

  return {
    intent: state.intent,
    report,
    toolTrace,
  };
}
