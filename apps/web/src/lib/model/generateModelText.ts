import type { SmartWalletModelConfig } from "@nexora/shared";

export type GenerateModelTextInput = {
  apiKey?: string;
  config: SmartWalletModelConfig;
  prompt: string;
  timeoutMs?: number;
};

export type GenerateModelTextResult = {
  latencyMs: number;
  rawResponse: string;
  text: string;
};

function appendPath(baseUrl: string, path: string) {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  return trimmedBase.endsWith(path) ? trimmedBase : `${trimmedBase}${path}`;
}

function openAiChatUrl(endpointUrl: string) {
  const trimmed = endpointUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/v1/chat/completions`;
}

async function readJsonOrText(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await response.json();
    return {
      json,
      raw: JSON.stringify(json, null, 2),
    };
  }

  const text = await response.text();
  return {
    json: undefined,
    raw: text,
  };
}

function textFromPayload(payload: unknown, raw: string) {
  if (!payload || typeof payload !== "object") {
    return raw;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.response === "string") {
    return record.response;
  }

  if (typeof record.text === "string") {
    return record.text;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string") {
      return message.content;
    }

    if (typeof firstChoice?.text === "string") {
      return firstChoice.text;
    }
  }

  return raw;
}

export async function generateModelText({
  apiKey,
  config,
  prompt,
  timeoutMs = 30000,
}: GenerateModelTextInput): Promise<GenerateModelTextResult> {
  const connectionType = config.connectionType ?? "demo";
  const startedAt = performance.now();

  if (connectionType === "demo") {
    return {
      latencyMs: Math.round(performance.now() - startedAt),
      rawResponse: JSON.stringify({
        selectedVault: "LegacyBenchmarkTarget",
        confidence: 0.92,
        rejectedVaults: ["LegacyYieldTarget", "LegacyRiskTarget"],
        reasoning: "Demo model selects the lowest-risk verified vault.",
      }, null, 2),
      text: JSON.stringify({
        selectedVault: "LegacyBenchmarkTarget",
        confidence: 0.92,
        rejectedVaults: ["LegacyYieldTarget", "LegacyRiskTarget"],
        reasoning: "Demo model selects the lowest-risk verified vault.",
      }),
    };
  }

  if (!config.endpointUrl) {
    throw new Error("Model endpoint URL is required.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: HeadersInit = {
      "content-type": "application/json",
    };

    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const request =
      connectionType === "ollama-compatible"
        ? {
            body: JSON.stringify({
              model: config.modelName,
              prompt,
              stream: false,
              options: {
                temperature: config.temperature,
                num_predict: config.maxTokens,
              },
            }),
            url: appendPath(config.endpointUrl, "/api/generate"),
          }
        : connectionType === "custom-http"
          ? {
              body: JSON.stringify({
                model: config.modelName,
                prompt,
                temperature: config.temperature,
                max_tokens: config.maxTokens,
              }),
              url: config.endpointUrl,
            }
          : {
              body: JSON.stringify({
                messages: [{ content: prompt, role: "user" }],
                model: config.modelName,
                temperature: config.temperature,
                max_tokens: config.maxTokens,
              }),
              url: openAiChatUrl(config.endpointUrl),
            };

    const response = await fetch(request.url, {
      body: request.body,
      headers,
      method: "POST",
      signal: controller.signal,
    });
    const { json, raw } = await readJsonOrText(response);

    if (!response.ok) {
      throw new Error(`Model endpoint returned HTTP ${response.status}: ${raw}`);
    }

    return {
      latencyMs: Math.round(performance.now() - startedAt),
      rawResponse: raw,
      text: textFromPayload(json, raw),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Model connection timed out after ${timeoutMs / 1000} seconds.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
