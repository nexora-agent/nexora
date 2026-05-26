export type ToolTraceStatus = "success" | "error";

export type ToolTraceEntry = {
  index: number;
  toolName: string;
  status: ToolTraceStatus;
  summary: string;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  harnessIds: string[];
  inputSchema?: Record<string, unknown>;
};
