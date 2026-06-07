"use client";

import { useEffect, useState } from "react";
import {
  getRunnerStatus,
  saveRunnerConfig,
  testRunnerModel,
  type RunnerConfig,
} from "@/lib/runner/runnerClient";

type TestState = "idle" | "testing" | "connected" | "failed";
type SaveState = "idle" | "saving" | "saved" | "error";

const DEFAULT_MODEL: RunnerConfig["model"] = {
  endpointUrl: "http://127.0.0.1:11434/api/generate",
  maxTokens: 1600,
  modelName: "qwen2.5:7b",
  provider: "ollama",
  temperature: 0.2,
};

type Props = {
  compact?: boolean;
  description?: string;
  onSaved?: (model: RunnerConfig["model"]) => void;
  title?: string;
};

export function RunnerModelSetupCard({
  compact = false,
  description,
  onSaved,
  title = "AI Setup",
}: Props) {
  const [baseConfig, setBaseConfig] = useState<RunnerConfig | undefined>();
  const [endpointUrl, setEndpointUrl] = useState(DEFAULT_MODEL.endpointUrl);
  const [modelName, setModelName] = useState(DEFAULT_MODEL.modelName);
  const [temperature, setTemperature] = useState(DEFAULT_MODEL.temperature);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MODEL.maxTokens);
  const [isLoading, setIsLoading] = useState(true);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    getRunnerStatus()
      .then((status) => {
        const m = status.config.model;
        setBaseConfig(status.config);
        setEndpointUrl(m.endpointUrl);
        setModelName(m.modelName);
        setTemperature(m.temperature);
        setMaxTokens(m.maxTokens);
      })
      .catch(() => {
        // runner offline — keep defaults, user can still edit and save
      })
      .finally(() => setIsLoading(false));
  }, []);

  const buildCurrentConfig = (): RunnerConfig => {
    const base = baseConfig ?? {
      actionAmountMnt: "0.01",
      agentId: "",
      agentObjective:
        "Evaluate the active benchmark and execute only when the live case passes the configured policy.",
      autoIntervalSeconds: 120,
      mcpServers: [],
      model: DEFAULT_MODEL,
      modelHarness: { prompt: "" },
    };
    return {
      ...base,
      model: { ...base.model, endpointUrl, maxTokens, modelName, temperature },
    };
  };

  const testConnection = async () => {
    setTestState("testing");
    setTestMessage("");
    try {
      const result = await testRunnerModel(buildCurrentConfig());
      setTestState("connected");
      setTestMessage(`Connected in ${result.latencyMs}ms`);
    } catch (err) {
      setTestState("failed");
      setTestMessage(err instanceof Error ? err.message : "Connection failed.");
    }
  };

  const saveSettings = async () => {
    setSaveState("saving");
    setSaveMessage("");
    try {
      const latest = await getRunnerStatus();
      const merged: RunnerConfig = {
        ...latest.config,
        model: { ...latest.config.model, endpointUrl, maxTokens, modelName, temperature },
      };
      await saveRunnerConfig(merged);
      setBaseConfig(merged);
      setSaveState("saved");
      onSaved?.(merged.model);
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Could not save settings.");
    }
  };

  const isBusy = testState === "testing" || saveState === "saving";

  const testLabel =
    testState === "testing"
      ? "Testing..."
      : testState === "connected"
        ? "Connected"
        : testState === "failed"
          ? "Failed"
          : "Test Connection";

  const saveLabel =
    saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save Settings";

  return (
    <section
      className={`runner-model-setup-card${compact ? " runner-model-setup-compact" : ""}`}
      aria-label="AI model setup"
    >
      <div className="runner-model-setup-header">
        <div>
          <h3>{title}</h3>
          {description && <p className="runner-note runner-model-setup-desc">{description}</p>}
        </div>
        <div className="runner-model-status-pills">
          <span className="runner-model-provider-pill">Ollama</span>
          {testState === "connected" && (
            <span className="status-pill status-ready runner-model-status-pill">Connected</span>
          )}
          {testState === "failed" && (
            <span className="status-pill status-disconnected runner-model-status-pill">Failed</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="runner-model-skeleton">
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-short" />
        </div>
      ) : (
        <div className="runner-model-setup-fields">
          <label className="runner-model-field">
            <span>Endpoint URL</span>
            <input
              onChange={(e) => {
                setEndpointUrl(e.target.value);
                setTestState("idle");
              }}
              type="text"
              value={endpointUrl}
            />
          </label>
          <label className="runner-model-field">
            <span>Model</span>
            <input
              onChange={(e) => {
                setModelName(e.target.value);
                setTestState("idle");
              }}
              type="text"
              value={modelName}
            />
          </label>
          <label className="runner-model-field runner-model-field-narrow">
            <span>Temperature</span>
            <input
              min="0"
              onChange={(e) => setTemperature(Number(e.target.value))}
              step="0.1"
              type="number"
              value={temperature}
            />
          </label>
          <label className="runner-model-field runner-model-field-narrow">
            <span>Max tokens</span>
            <input
              min="128"
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              type="number"
              value={maxTokens}
            />
          </label>
        </div>
      )}

      {testMessage && (
        <p
          className={`runner-model-test-result ${testState === "failed" ? "runner-model-test-failed" : ""}`}
        >
          {testMessage}
        </p>
      )}
      {saveState === "error" && <p className="error-text">{saveMessage}</p>}

      <div className="runner-model-setup-actions">
        <button
          className={`ghost-action runner-model-test-btn runner-model-test-${testState}`}
          disabled={isBusy || isLoading}
          onClick={() => void testConnection()}
          type="button"
        >
          {testLabel}
        </button>
        <button
          className={`secondary-action runner-model-save-btn runner-model-save-${saveState}`}
          disabled={isBusy || isLoading}
          onClick={() => void saveSettings()}
          type="button"
        >
          {saveLabel}
        </button>
      </div>
    </section>
  );
}
