import type { AgentProfile } from "../types/Agent";
import type { PolicyProfile } from "../types/Policy";

export const demoAgent: AgentProfile = {
  id: "planned-agent-1",
  name: "YieldGuard-01",
  goal: "Safe DeFi activity on Mantle",
  riskMode: "conservative",
};

export const demoPolicy: PolicyProfile = {
  maxRiskScore: 60,
  maxTransactionSizeUsd: 20,
  blockUnlimitedApprovals: true,
  blockUnverifiedContracts: true,
  requireRiskReport: true,
};

export const productSteps = [
  "Create an AI agent",
  "Give it a limited smart wallet",
  "Set safety rules",
  "Let it propose actions",
  "Record reputation on-chain",
];

export const mvpLoop = [
  "Create agent",
  "Create wallet",
  "Set policy",
  "Propose action",
  "Analyze risk",
  "Store report",
  "Execute/block",
  "Update reputation",
];
