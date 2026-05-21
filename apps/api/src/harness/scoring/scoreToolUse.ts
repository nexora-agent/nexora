import type { ToolTraceEntry } from "@nexora/shared";

export function scoreToolUse(toolTrace: ToolTraceEntry[]) {
  const successfulCalls = toolTrace.filter((entry) => entry.status === "success");
  return Math.min(100, successfulCalls.length * 20);
}
