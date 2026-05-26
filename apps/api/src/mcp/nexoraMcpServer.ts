import type { FastifyInstance } from "fastify";
import { demoPolicy, type PolicyProfile } from "@nexora/shared";
import { runAgent } from "../agent/agentRunner";
import {
  getTool,
  isToolAvailableForHarness,
  listToolsForHarness,
  toolRegistry,
} from "./toolRegistry";
import type { ToolContext, ToolExecutionState, ToolInput } from "./toolTypes";

type RunAgentBody = {
  agentId: string;
  agentName?: string;
  harnessId: string;
  policy: PolicyProfile;
  task: string;
  tokenAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
};

type CallToolBody = {
  context: ToolContext;
  input?: ToolInput;
  state?: ToolExecutionState;
  toolName: string;
};

type JsonRpcRequest = {
  id?: number | string | null;
  jsonrpc?: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return {
    id: id ?? null,
    jsonrpc: "2.0",
    result,
  };
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return {
    error: {
      code,
      message,
    },
    id: id ?? null,
    jsonrpc: "2.0",
  };
}

function toolToPublicDefinition({
  description,
  harnessIds,
  inputSchema,
  name,
}: (typeof toolRegistry)[number]) {
  return {
    description,
    harnessIds,
    inputSchema,
    name,
  };
}

function publicTools(harnessId?: string) {
  if (harnessId) {
    return listToolsForHarness(harnessId);
  }

  return toolRegistry.map(toolToPublicDefinition);
}

function defaultContext(params?: Record<string, unknown>): ToolContext {
  const context = params?.context as Partial<ToolContext> | undefined;
  const args = params?.arguments as Record<string, unknown> | undefined;
  const harnessId =
    context?.harnessId ??
    (typeof params?.harnessId === "string" ? params.harnessId : undefined) ??
    (typeof args?.harnessId === "string" ? args.harnessId : undefined) ??
    "safe-yield";

  return {
    agentId: context?.agentId ?? "mcp-agent",
    agentName: context?.agentName,
    harnessId,
    policy: context?.policy ?? demoPolicy,
    walletAddress: context?.walletAddress,
  };
}

function normalizeToolCallParams(params?: Record<string, unknown>): CallToolBody {
  const args = (params?.arguments ?? {}) as ToolInput;

  return {
    context: defaultContext(params),
    input: (params?.input as ToolInput | undefined) ?? args,
    state: params?.state as ToolExecutionState | undefined,
    toolName: String(params?.toolName ?? params?.name ?? ""),
  };
}

async function callTool(body: CallToolBody) {
  const tool = getTool(body.toolName);

  if (!tool) {
    throw new Error(`Tool ${body.toolName} was not found.`);
  }

  if (!isToolAvailableForHarness(tool, body.context.harnessId)) {
    throw new Error(`Tool ${body.toolName} is not available for ${body.context.harnessId}.`);
  }

  const state = body.state ?? {};
  const result = await tool.execute(body.context, body.input ?? {}, state);

  return {
    result,
    state,
    tool: {
      description: tool.description,
      inputSchema: tool.inputSchema,
      name: tool.name,
    },
  };
}

export async function nexoraMcpServer(app: FastifyInstance) {
  app.get("/mcp/tools", async () => ({
    tools: publicTools(),
  }));

  app.get("/mcp/manifest", async () => ({
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    name: "nexora-mcp",
    protocolVersion: "2024-11-05",
    serverInfo: {
      name: "nexora-mcp",
      version: "0.1.0",
    },
    tools: publicTools(),
  }));

  app.get<{ Params: { harnessId: string } }>(
    "/mcp/tools/:harnessId",
    async (request) => ({
      tools: listToolsForHarness(request.params.harnessId),
    }),
  );

  app.post<{ Body: CallToolBody }>("/mcp/call-tool", async (request, reply) => {
    try {
      return await callTool(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not call tool.",
      });
    }
  });

  app.post<{ Body: JsonRpcRequest }>("/mcp", async (request, reply) => {
    try {
      const body = request.body;

      if (body.method === "tools/list") {
        const harnessId =
          typeof body.params?.harnessId === "string"
            ? body.params.harnessId
            : undefined;
        const tools = publicTools(harnessId);

        return jsonRpcResult(body.id, { tools });
      }

      if (body.method === "initialize") {
        return jsonRpcResult(body.id, {
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          instructions:
            "Use tools/list to inspect Nexora tools and tools/call to request benchmark, policy, risk, and Byreal dry-run tools.",
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "nexora-mcp",
            version: "0.1.0",
          },
        });
      }

      if (body.method === "tools/call") {
        return jsonRpcResult(body.id, await callTool(normalizeToolCallParams(body.params)));
      }

      if (body.method === "agent/run") {
        return jsonRpcResult(body.id, await runAgent(body.params as RunAgentBody));
      }

      return reply.code(400).send(jsonRpcError(body.id, -32601, "Method not found."));
    } catch (error) {
      return reply.code(400).send(
        jsonRpcError(
          request.body?.id,
          -32000,
          error instanceof Error ? error.message : "MCP request failed.",
        ),
      );
    }
  });

  app.post<{ Body: RunAgentBody }>("/mcp/run-agent", async (request, reply) => {
    try {
      return await runAgent(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not run agent.",
      });
    }
  });
}
