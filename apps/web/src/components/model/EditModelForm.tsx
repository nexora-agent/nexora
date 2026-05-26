"use client";

import type {
  SmartWalletModelConfig,
  SmartWalletModelConnectionType,
  SmartWalletExecutionMode,
  RunnerMode,
} from "@nexora/shared";
import { useState } from "react";
import {
  type ModelConnectionTestResult,
  testModelConnection,
} from "@/lib/model/testModelConnection";

type EditModelFormProps = {
  config: SmartWalletModelConfig;
  isOwner: boolean;
  onSave: (config: SmartWalletModelConfig) => void;
};

const connectionTypes: Array<{
  label: string;
  value: SmartWalletModelConnectionType;
}> = [
  { label: "Demo Model", value: "demo" },
  { label: "OpenAI-compatible", value: "openai-compatible" },
  { label: "Ollama-compatible", value: "ollama-compatible" },
  { label: "Custom HTTP", value: "custom-http" },
];

function providerForRunner(runnerMode: RunnerMode): SmartWalletModelConfig["provider"] {
  if (runnerMode === "hosted") {
    return "hosted";
  }

  return runnerMode === "local" ? "local" : "demo";
}

export function EditModelForm({ config, isOwner, onSave }: EditModelFormProps) {
  const [draft, setDraft] = useState<SmartWalletModelConfig>({
    ...config,
    connectionType: config.connectionType ?? "demo",
  });
  const [apiKey, setApiKey] = useState("");
  const [testPrompt, setTestPrompt] = useState('Return JSON: {"status":"ok"}');
  const [testResult, setTestResult] =
    useState<ModelConnectionTestResult | undefined>();
  const [testError, setTestError] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const updateDraft = (patch: Partial<SmartWalletModelConfig>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const runConnectionTest = async () => {
    setIsTesting(true);
    setTestError("");
    setTestResult(undefined);

    try {
      const result = await testModelConnection({
        apiKey,
        config: draft,
        prompt: testPrompt,
      });
      setTestResult(result);
    } catch (error) {
      setTestError(
        error instanceof Error ? error.message : "Model connection failed.",
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label>
        <span>Runner Mode</span>
        <select
          name="runnerMode"
          onChange={(event) => {
            const runnerMode = event.target.value as RunnerMode;
            updateDraft({
              provider: providerForRunner(runnerMode),
              runnerMode,
            });
          }}
          value={draft.runnerMode}
        >
          <option value="demo">Demo Model</option>
          <option value="local">Local Model</option>
          <option disabled value="hosted">
            Hosted Model - coming soon
          </option>
        </select>
      </label>
      <label>
        <span>Connection Type</span>
        <select
          aria-label="Connection Type"
          name="connectionType"
          onChange={(event) =>
            updateDraft({
              connectionType: event.target.value as SmartWalletModelConnectionType,
            })
          }
          value={draft.connectionType ?? "demo"}
        >
          {connectionTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Provider</span>
        <select
          name="provider"
          onChange={(event) =>
            updateDraft({
              provider: event.target.value as SmartWalletModelConfig["provider"],
            })
          }
          value={draft.provider}
        >
          <option value="demo">Demo</option>
          <option value="local">Local</option>
          <option disabled value="hosted">
            Hosted - coming soon
          </option>
        </select>
      </label>
      <label>
        <span>Model Name</span>
        <input
          aria-label="Edit model name"
          name="modelName"
          onChange={(event) => updateDraft({ modelName: event.target.value })}
          type="text"
          value={draft.modelName}
        />
      </label>
      <label>
        <span>Endpoint URL</span>
        <input
          aria-label="Edit endpoint URL"
          name="endpointUrl"
          onChange={(event) => updateDraft({ endpointUrl: event.target.value })}
          placeholder="http://localhost:11434/v1"
          type="url"
          value={draft.endpointUrl ?? ""}
        />
      </label>
      <label>
        <span>API Key</span>
        <input
          aria-label="Session API key"
          autoComplete="off"
          name="sessionApiKey"
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Session only"
          type="password"
          value={apiKey}
        />
      </label>
      <label>
        <span>Temperature</span>
        <input
          aria-label="Edit temperature"
          max="2"
          min="0"
          name="temperature"
          onChange={(event) => updateDraft({ temperature: Number(event.target.value) })}
          step="0.1"
          type="number"
          value={draft.temperature}
        />
      </label>
      <label>
        <span>Max Tokens</span>
        <input
          aria-label="Edit max tokens"
          min="100"
          name="maxTokens"
          onChange={(event) => updateDraft({ maxTokens: Number(event.target.value) })}
          step="100"
          type="number"
          value={draft.maxTokens}
        />
      </label>
      <label>
        <span>Execution Mode</span>
        <select
          name="executionMode"
          onChange={(event) =>
            updateDraft({
              executionMode: event.target.value as SmartWalletExecutionMode,
            })
          }
          value={draft.executionMode}
        >
          <option value="simulation">Simulation</option>
          <option value="policy-gated">Policy gated</option>
          <option value="live-disabled">Live disabled</option>
        </select>
      </label>
      <label>
        <span>Test Prompt</span>
        <textarea
          aria-label="Model test prompt"
          onChange={(event) => setTestPrompt(event.target.value)}
          value={testPrompt}
        />
      </label>
      <section className="summary-card" aria-label="Model connection test">
        <div className="card-heading-row">
          <h3>Connection Test</h3>
          <button
            className="secondary-action"
            disabled={isTesting}
            onClick={() => void runConnectionTest()}
            type="button"
          >
            {isTesting ? "Testing..." : "Test Model"}
          </button>
        </div>
        {testResult && (
          <div className="model-test-result">
            <span
              className={`status-pill ${
                testResult.ok ? "status-ready" : "status-wrong-network"
              }`}
            >
              {testResult.ok ? "Connected" : "Check response"}
            </span>
            <p>{testResult.message}</p>
            <p>{testResult.latencyMs} ms</p>
            <pre>{testResult.rawResponse}</pre>
          </div>
        )}
        {testError && <p className="error-text">{testError}</p>}
      </section>
      <button className="primary-action" disabled={!isOwner} type="submit">
        Save Model
      </button>
    </form>
  );
}
