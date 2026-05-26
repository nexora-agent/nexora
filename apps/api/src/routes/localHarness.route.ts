import type { FastifyInstance } from "fastify";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { HarnessTemplate, McpToolDefinition, PolicyProfile } from "@nexora/shared";
import { getHarnessTemplate } from "../harness/harnessTemplates";
import { listToolsForHarness } from "../mcp/toolRegistry";
import {
  appendLocalHarnessRunLog,
  readLocalHarnessRunLogs,
} from "../services/localHarnessRunLog";

type LocalHarnessRunBody = {
  agent?: {
    id: string;
    name?: string;
    walletAddress?: `0x${string}`;
  };
  benchmarkContext?: unknown;
  endpointUrl: string;
  harness?: HarnessTemplate;
  harnessId?: string;
  localRuntimeSecret?: string;
  objective: string;
  policy: PolicyProfile;
  timeoutMs?: number;
};

type LocalHarnessPayload = {
  agent: {
    id: string;
    name?: string;
    walletAddress?: `0x${string}`;
  };
  harness: HarnessTemplate;
  benchmarkContext?: unknown;
  objective: string;
  policy: PolicyProfile;
  protocol: "nexora-local-harness";
  protocolVersion: "1";
  runId: string;
  timestamp: string;
  tools: McpToolDefinition[];
  toolManifest: {
    allowedToolNames: string[];
    hash: string;
  };
};

type LocalHarnessResponseBody = {
  usedTools?: unknown;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signPayload(input: {
  body: string;
  runId: string;
  secret: string;
  timestamp: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`${input.runId}.${input.timestamp}.${input.body}`)
    .digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function assertAllowedLocalRuntimeUrl(endpointUrl: string) {
  const url = new URL(endpointUrl);
  const allowedProtocols = new Set(["http:", "https:"]);

  if (!allowedProtocols.has(url.protocol)) {
    throw new Error("Local harness endpoint must use http or https.");
  }

  const host = url.hostname.toLowerCase();
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (!isLocalHost && process.env.NEXORA_ALLOW_REMOTE_HARNESS !== "true") {
    throw new Error(
      "Only local/private harness endpoints are allowed by default. Set NEXORA_ALLOW_REMOTE_HARNESS=true to allow remote runtimes.",
    );
  }

  return url.toString();
}

function assertAllowedToolUrl(toolUrl: string, toolName: string) {
  try {
    assertAllowedLocalRuntimeUrl(toolUrl);
  } catch (error) {
    throw new Error(
      `Tool ${toolName} has a blocked HTTP URL. ${
        error instanceof Error ? error.message : "Invalid URL."
      }`,
    );
  }
}

function toolsForHarness(harness: HarnessTemplate) {
  if (harness.source === "custom") {
    return harness.tools.map((tool) => ({
      description: tool.description,
      harnessIds: [harness.id],
      inputSchema: {
        type: "object",
        properties: {},
      },
      name: tool.name,
    }));
  }

  return listToolsForHarness(harness.id);
}

function validateToolManifest(harness: HarnessTemplate, tools: McpToolDefinition[]) {
  const names = tools.map((tool) => tool.name);
  const uniqueNames = new Set(names);

  if (names.length === 0) {
    throw new Error("Local harness must declare at least one tool.");
  }

  if (uniqueNames.size !== names.length) {
    throw new Error("Local harness tool names must be unique.");
  }

  for (const tool of harness.tools) {
    if (!tool.name.trim()) {
      throw new Error("Local harness tool names cannot be empty.");
    }

    if (tool.kind === "http" && tool.httpUrl) {
      assertAllowedToolUrl(tool.httpUrl, tool.name);
    }
  }
}

function validateUsedTools(responseBody: unknown, allowedToolNames: string[]) {
  if (!responseBody || typeof responseBody !== "object") {
    return [];
  }

  const usedTools = (responseBody as LocalHarnessResponseBody).usedTools;
  if (!Array.isArray(usedTools)) {
    return [];
  }

  const normalizedUsedTools = usedTools.map(String);
  const allowed = new Set(allowedToolNames);
  const blocked = normalizedUsedTools.filter((toolName) => !allowed.has(toolName));

  if (blocked.length > 0) {
    throw new Error(
      `Local harness reported undeclared tool usage: ${blocked.join(", ")}.`,
    );
  }

  return normalizedUsedTools;
}

async function callLocalHarness(input: LocalHarnessRunBody) {
  const endpointUrl = assertAllowedLocalRuntimeUrl(input.endpointUrl);
  const harness =
    input.harness ??
    getHarnessTemplate(input.harnessId ?? "safe-approval");
  if (!harness) {
    throw new Error(`Harness ${input.harnessId ?? "safe-approval"} was not found.`);
  }
  const tools = toolsForHarness(harness);
  validateToolManifest(harness, tools);
  const { localRuntimeSecret: _localRuntimeSecret, ...publicHarness } = harness;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 45000);
  const runId = randomUUID();
  const timestamp = new Date().toISOString();
  const allowedToolNames = tools.map((tool) => tool.name);
  const manifestHash = sha256(JSON.stringify(allowedToolNames.sort()));
  const payload: LocalHarnessPayload = {
    agent: input.agent ?? { id: "local-agent" },
    benchmarkContext: input.benchmarkContext,
    harness: publicHarness,
    objective: input.objective,
    policy: input.policy,
    protocol: "nexora-local-harness",
    protocolVersion: "1",
    runId,
    timestamp,
    tools,
    toolManifest: {
      allowedToolNames,
      hash: manifestHash,
    },
  };
  const requestBody = JSON.stringify(payload);
  const requestHash = sha256(requestBody);
  const secret =
    input.localRuntimeSecret?.trim() || process.env.NEXORA_LOCAL_HARNESS_SECRET;
  const signature = secret
    ? signPayload({
        body: requestBody,
        runId,
        secret,
        timestamp,
      })
    : undefined;

  try {
    const startedAt = Date.now();
    const response = await fetch(endpointUrl, {
      body: requestBody,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-nexora-protocol": "local-harness-v1",
        "x-nexora-request-hash": requestHash,
        "x-nexora-run-id": runId,
        "x-nexora-signature": signature ? `sha256=${signature}` : "unsigned",
        "x-nexora-timestamp": timestamp,
      },
      method: "POST",
      signal: controller.signal,
    });
    const rawText = await response.text();
    let responseBody: unknown = rawText;

    try {
      responseBody = JSON.parse(rawText);
    } catch {
      // Keep raw text for debugging malformed local harness responses.
    }

    if (!response.ok) {
      throw new Error(`Local harness returned HTTP ${response.status}: ${rawText}`);
    }
    const usedTools = validateUsedTools(responseBody, allowedToolNames);
    const latencyMs = Date.now() - startedAt;
    const responseHash = sha256(rawText);

    await appendLocalHarnessRunLog({
      agentId: payload.agent.id,
      createdAt: timestamp,
      endpointHost: new URL(endpointUrl).host,
      harnessId: harness.id,
      latencyMs,
      objective: input.objective,
      requestHash,
      responseHash,
      runId,
      status: "success",
      toolCount: tools.length,
      usedTools,
    });

    return {
      auth: {
        signed: Boolean(signature),
        signatureHeader: signature ? "x-nexora-signature" : undefined,
      },
      latencyMs,
      mode: "local-runtime",
      request: payload,
      requestHash,
      response: responseBody,
      responseHash,
      runId,
      runtimeUrl: endpointUrl,
      toolManifest: payload.toolManifest,
      usedTools,
    };
  } catch (error) {
    await appendLocalHarnessRunLog({
      agentId: payload.agent.id,
      createdAt: timestamp,
      endpointHost: new URL(endpointUrl).host,
      error: error instanceof Error ? error.message : "Local harness failed.",
      harnessId: harness.id,
      latencyMs: 0,
      objective: input.objective,
      requestHash,
      runId,
      status: "error",
      toolCount: tools.length,
      usedTools: [],
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function localHarnessRoute(app: FastifyInstance) {
  app.post<{ Body: LocalHarnessRunBody }>("/harness/local/run", async (request, reply) => {
    try {
      return await callLocalHarness(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not run local harness.",
      });
    }
  });

  app.get<{ Querystring: { limit?: string } }>("/harness/local/runs", async (request) => ({
    runs: await readLocalHarnessRunLogs(Number(request.query.limit ?? 25)),
  }));
}

export function verifyLocalHarnessSignature(input: {
  body: string;
  runId: string;
  secret: string;
  signatureHeader: string;
  timestamp: string;
}) {
  const signature = input.signatureHeader.replace(/^sha256=/, "");
  const expected = signPayload(input);

  return safeCompare(signature, expected);
}
