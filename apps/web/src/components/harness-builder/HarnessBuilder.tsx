"use client";

import type { HarnessTool, HarnessToolKind } from "@nexora/shared";
import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { createCustomHarness } from "@/lib/harness/customHarnessRegistry";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

const toolKinds: Array<{ label: string; value: HarnessToolKind }> = [
  { label: "Built-in", value: "builtin" },
  { label: "Contract Read", value: "contract-read" },
  { label: "Intent Builder", value: "intent-builder" },
  { label: "HTTP", value: "http" },
  { label: "Code", value: "code" },
];

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeToolName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function HarnessBuilder() {
  const { address, isConnected } = useWalletConnection();
  const [name, setName] = useState("Treasury Operations Harness");
  const [summary, setSummary] = useState("Policy-gated treasury actions.");
  const [instructions, setInstructions] = useState(
    "Use bounded intents only. Inspect contracts before proposing write actions.",
  );
  const [allowedActionTypes, setAllowedActionTypes] = useState(
    "erc20_transfer, erc20_approval",
  );
  const [blockedActionTypes, setBlockedActionTypes] = useState(
    "unlimited approvals, unverified contracts",
  );
  const [riskRules, setRiskRules] = useState(
    "Block unlimited approvals\nRequire verified targets\nRequire risk report before execution",
  );
  const [requiredReports, setRequiredReports] = useState(
    "risk_report, tool_trace, intent_hash",
  );
  const [tools, setTools] = useState<HarnessTool[]>([
    {
      id: "get_wallet_balance",
      name: "get_wallet_balance",
      description: "Read the smart wallet balance.",
      kind: "builtin",
      sponsorSurface: "nexora",
    },
  ]);
  const [toolName, setToolName] = useState("read_contract_state");
  const [toolKind, setToolKind] = useState<HarnessToolKind>("contract-read");
  const [toolDescription, setToolDescription] = useState(
    "Read protocol state from a verified contract.",
  );
  const [contractAddress, setContractAddress] = useState("");
  const [abiFunction, setAbiFunction] = useState("");
  const [httpUrl, setHttpUrl] = useState("");
  const [sourcePreview, setSourcePreview] = useState("");
  const [error, setError] = useState("");

  const addTool = () => {
    setError("");
    const normalizedName = normalizeToolName(toolName);

    if (!normalizedName) {
      setError("Tool name is required.");
      return;
    }

    const tool: HarnessTool = {
      id: normalizedName,
      name: normalizedName,
      description: toolDescription.trim() || normalizedName,
      kind: toolKind,
      sponsorSurface: "nexora",
      contractAddress: contractAddress.trim()
        ? (contractAddress.trim() as `0x${string}`)
        : undefined,
      abiFunction: abiFunction.trim() || undefined,
      httpMethod: toolKind === "http" ? "POST" : undefined,
      httpUrl: httpUrl.trim() || undefined,
      sourcePreview: sourcePreview.trim() || undefined,
    };

    setTools((currentTools) => [...currentTools, tool]);
    setToolName("");
    setToolDescription("");
    setContractAddress("");
    setAbiFunction("");
    setHttpUrl("");
    setSourcePreview("");
  };

  const saveHarness = () => {
    setError("");

    if (!name.trim()) {
      setError("Harness name is required.");
      return;
    }

    const harness = createCustomHarness({
      name,
      summary,
      instructions,
      ownerAddress: address,
      tools,
      allowedActionTypes: splitLines(allowedActionTypes),
      blockedActionTypes: splitLines(blockedActionTypes),
      riskRules: splitLines(riskRules),
      requiredReports: splitLines(requiredReports),
    });

    window.location.href = `/harnesses?created=${encodeURIComponent(harness.id)}`;
  };

  return (
    <section className="harness-builder-card" aria-label="Harness builder">
      <div className="form-grid">
        <label>
          <span>Harness Name</span>
          <input
            aria-label="Harness Name"
            onChange={(event) => setName(event.target.value)}
            type="text"
            value={name}
          />
        </label>

        <label>
          <span>Summary</span>
          <input
            aria-label="Summary"
            onChange={(event) => setSummary(event.target.value)}
            type="text"
            value={summary}
          />
        </label>

        <label>
          <span>Runtime Instructions</span>
          <textarea
            aria-label="Runtime Instructions"
            onChange={(event) => setInstructions(event.target.value)}
            value={instructions}
          />
        </label>

        <div className="harness-builder-grid">
          <label>
            <span>Allowed Actions</span>
            <textarea
              aria-label="Allowed Actions"
              onChange={(event) => setAllowedActionTypes(event.target.value)}
              value={allowedActionTypes}
            />
          </label>
          <label>
            <span>Blocked Actions</span>
            <textarea
              aria-label="Blocked Actions"
              onChange={(event) => setBlockedActionTypes(event.target.value)}
              value={blockedActionTypes}
            />
          </label>
          <label>
            <span>Risk Rules</span>
            <textarea
              aria-label="Risk Rules"
              onChange={(event) => setRiskRules(event.target.value)}
              value={riskRules}
            />
          </label>
          <label>
            <span>Required Reports</span>
            <textarea
              aria-label="Required Reports"
              onChange={(event) => setRequiredReports(event.target.value)}
              value={requiredReports}
            />
          </label>
        </div>
      </div>

      <section className="tool-builder-panel" aria-label="Tool builder">
        <div className="console-topline">
          <span>Tools</span>
          <span className="status-pill status-ready">{tools.length}</span>
        </div>

        <div className="tool-list">
          {tools.map((tool) => (
            <div key={tool.id}>
              <strong>{tool.name}</strong>
              <span>{tool.kind ?? "builtin"}</span>
            </div>
          ))}
        </div>

        <div className="harness-builder-grid">
          <label>
            <span>Tool Name</span>
            <input
              aria-label="Tool Name"
              onChange={(event) => setToolName(event.target.value)}
              type="text"
              value={toolName}
            />
          </label>
          <label>
            <span>Tool Kind</span>
            <select
              aria-label="Tool Kind"
              onChange={(event) =>
                setToolKind(event.target.value as HarnessToolKind)
              }
              value={toolKind}
            >
              {toolKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Description</span>
            <input
              aria-label="Tool Description"
              onChange={(event) => setToolDescription(event.target.value)}
              type="text"
              value={toolDescription}
            />
          </label>
          <label>
            <span>Contract Address</span>
            <input
              aria-label="Contract Address"
              onChange={(event) => setContractAddress(event.target.value)}
              type="text"
              value={contractAddress}
            />
          </label>
          <label>
            <span>ABI Function</span>
            <input
              aria-label="ABI Function"
              onChange={(event) => setAbiFunction(event.target.value)}
              type="text"
              value={abiFunction}
            />
          </label>
          <label>
            <span>HTTP URL</span>
            <input
              aria-label="HTTP URL"
              onChange={(event) => setHttpUrl(event.target.value)}
              type="text"
              value={httpUrl}
            />
          </label>
        </div>

        <label className="code-tool-field">
          <span>Code Preview</span>
          <textarea
            aria-label="Code Preview"
            onChange={(event) => setSourcePreview(event.target.value)}
            value={sourcePreview}
          />
        </label>

        <button className="secondary-action" onClick={addTool} type="button">
          Add Tool
        </button>
      </section>

      {!isConnected && <ConnectWalletButton />}
      {error && <p className="error-text">{error}</p>}

      <button className="primary-action form-submit" onClick={saveHarness} type="button">
        Save Harness
      </button>
    </section>
  );
}
