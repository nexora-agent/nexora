"use client";

import type { AgentRecord } from "@nexora/shared";
import { useState } from "react";
import { HarnessSelector } from "../harness/HarnessSelector";
import { IntentBuilder } from "../intent/IntentBuilder";
import { ObjectiveRunner } from "../objective/ObjectiveRunner";
import { PolicyEditor } from "../policy/PolicyEditor";
import { ReputationPanel } from "../reputation/ReputationPanel";
import { AgentWalletBalance } from "../wallet/AgentWalletBalance";
import { AgentWalletCard } from "../wallet/AgentWalletCard";
import { FundWalletPanel } from "../wallet/FundWalletPanel";
import { getHarnessTemplate } from "@/lib/harness/harnessTemplates";
import { AgentCapabilityCard } from "./AgentCapabilityCard";
import { AgentLifecycleProgress } from "./AgentLifecycleProgress";
import { AgentStatusBadge, getAgentStatus } from "./AgentStatusBadge";

type AgentProfileCardProps = {
  agent: AgentRecord;
  connectedAddress?: `0x${string}`;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatValue(value?: string) {
  if (!value) {
    return "Not set";
  }

  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function AgentProfileCard({
  agent,
  connectedAddress,
}: AgentProfileCardProps) {
  const [currentAgent, setCurrentAgent] = useState(agent);
  const isOwner =
    connectedAddress?.toLowerCase() === currentAgent.ownerAddress.toLowerCase();
  const isViewOnly = Boolean(connectedAddress && !isOwner);
  const harness = getHarnessTemplate(currentAgent.selectedHarnessId);
  const latestRun = currentAgent.objectiveRuns?.[0];
  const status = getAgentStatus(currentAgent);

  return (
    <div className="agent-detail-layout">
      <section className="agent-hero-card" aria-label="Smart wallet profile">
        <div>
          <h2>{currentAgent.name}</h2>
          <p>{currentAgent.description ?? currentAgent.goal}</p>
        </div>
        <AgentStatusBadge status={status} />
        <dl className="agent-metric-grid">
          <div>
            <dt>Benchmark</dt>
            <dd>{latestRun?.benchmarkScore?.finalScore ?? "—"}</dd>
          </div>
          <div>
            <dt>Smart Wallet</dt>
            <dd>
              {currentAgent.walletAddress
                ? formatAddress(currentAgent.walletAddress)
                : "Not created"}
            </dd>
          </div>
          <div>
            <dt>Runner</dt>
            <dd>{formatValue(currentAgent.runnerMode ?? "demo")}</dd>
          </div>
          <div>
            <dt>Harness</dt>
            <dd>{harness.name}</dd>
          </div>
        </dl>
      </section>

      {isViewOnly && (
        <section className="agent-section-card" aria-label="View only access">
          <h3>View only</h3>
          <p>Only the owner wallet can edit this smart wallet.</p>
        </section>
      )}

      <AgentLifecycleProgress agent={currentAgent} />
      <AgentCapabilityCard agent={currentAgent} />

      <nav className="agent-section-nav" aria-label="Smart wallet sections">
        <a href="#overview">Overview</a>
        <a href="#harness">Harness</a>
        <a href="#wallet">Smart Wallet</a>
        <a href="#objective">Objective Runner</a>
        <a href="#benchmark">Benchmark</a>
        <a href="#risk">Risk Reports</a>
        <a href="#reputation">Reputation</a>
        <a href="#advanced">Advanced</a>
      </nav>

      <section className="agent-section-card" id="overview">
        <h3>Overview</h3>
        <dl>
          <div>
            <dt>Wallet Type</dt>
            <dd>{formatValue(currentAgent.agentType ?? "custom")}</dd>
          </div>
          <div>
            <dt>Risk Style</dt>
            <dd>{formatValue(currentAgent.riskMode)}</dd>
          </div>
          <div>
            <dt>Primary Purpose</dt>
            <dd>{currentAgent.primaryPurpose ?? currentAgent.goal}</dd>
          </div>
          <div>
            <dt>Decision Style</dt>
            <dd>{currentAgent.decisionStyle ?? formatValue(currentAgent.strategyType)}</dd>
          </div>
          <div>
            <dt>Preferred Behavior</dt>
            <dd>{currentAgent.preferredBehavior ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Avoided Behavior</dt>
            <dd>{currentAgent.avoidedBehavior ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{formatAddress(currentAgent.ownerAddress)}</dd>
          </div>
        </dl>
      </section>

      <section className="agent-section-card" id="harness">
        <HarnessSelector
          agent={currentAgent}
          isOwner={Boolean(isOwner)}
          onHarnessSaved={setCurrentAgent}
        />
      </section>

      <section className="agent-section-card" id="wallet">
        <AgentWalletCard
          agent={currentAgent}
          isOwner={Boolean(isOwner)}
          onWalletCreated={setCurrentAgent}
        />
      </section>

      <section className="agent-section-card" id="funding">
        <h3>Funding</h3>
        <AgentWalletBalance walletAddress={currentAgent.walletAddress} />
        <FundWalletPanel walletAddress={currentAgent.walletAddress} />
      </section>

      <section className="agent-section-card" id="objective">
        <ObjectiveRunner
          agent={currentAgent}
          isOwner={Boolean(isOwner)}
          onObjectiveRunSaved={setCurrentAgent}
        />
      </section>

      <section className="agent-section-card" id="benchmark">
        <h3>Benchmark</h3>
        <dl>
          <div>
            <dt>Final Score</dt>
            <dd>{latestRun?.benchmarkScore?.finalScore ?? "No benchmark yet"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {(latestRun?.benchmarkScore?.finalScore ?? 0) >= 70
                ? "Good enough for limited live mode"
                : "Run benchmark objective"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="agent-section-card" id="risk">
        <h3>Risk Reports</h3>
        <dl>
          <div>
            <dt>Latest Risk</dt>
            <dd>{latestRun?.riskReport?.riskScore ?? "No report yet"}</dd>
          </div>
          <div>
            <dt>Decision</dt>
            <dd>{latestRun?.riskReport?.policyDecision ?? "No report yet"}</dd>
          </div>
        </dl>
      </section>

      <section className="agent-section-card" id="reputation">
        <ReputationPanel agent={currentAgent} />
      </section>

      <section className="agent-section-card" id="advanced">
        <PolicyEditor
          agent={currentAgent}
          isOwner={Boolean(isOwner)}
          ownerAddress={connectedAddress}
          onPolicySaved={setCurrentAgent}
        />
        <IntentBuilder agent={currentAgent} isOwner={Boolean(isOwner)} />
      </section>
    </div>
  );
}
