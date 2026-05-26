import type { SmartWalletModelConfig } from "@nexora/shared";
import { generateModelText } from "./generateModelText";

export type ModelConnectionTestResult = {
  latencyMs: number;
  message: string;
  ok: boolean;
  rawResponse: string;
};

export type ModelConnectionTestInput = {
  apiKey?: string;
  config: SmartWalletModelConfig;
  prompt: string;
};

function responseLooksHealthy(rawResponse: string) {
  const normalized = rawResponse.toLowerCase();
  return (
    normalized.includes("\"status\"") ||
    normalized.includes("ok") ||
    normalized.includes("message") ||
    normalized.includes("response")
  );
}

export async function testModelConnection({
  apiKey,
  config,
  prompt,
}: ModelConnectionTestInput): Promise<ModelConnectionTestResult> {
  const startedAt = performance.now();
  const connectionType = config.connectionType ?? "demo";

  if (connectionType === "demo") {
    return {
      latencyMs: Math.round(performance.now() - startedAt),
      message: "Demo model responded.",
      ok: true,
      rawResponse: JSON.stringify({ status: "ok", provider: "demo" }, null, 2),
    };
  }

  try {
    const result = await generateModelText({
      apiKey,
      config: {
        ...config,
        maxTokens: Math.min(config.maxTokens, 128),
      },
      prompt,
      timeoutMs: 10000,
    });

    return {
      latencyMs: result.latencyMs,
      message: responseLooksHealthy(result.rawResponse)
        ? "Model connection succeeded."
        : "Model responded, but the health response was not clearly recognized.",
      ok: responseLooksHealthy(result.rawResponse),
      rawResponse: result.rawResponse,
    };
  } catch (error) {
    throw error;
  }
}
