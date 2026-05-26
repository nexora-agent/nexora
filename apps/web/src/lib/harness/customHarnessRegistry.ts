"use client";

import type { HarnessTemplate, HarnessTool } from "@nexora/shared";

const customHarnessesKey = "nexora.customHarnesses";

export type CreateCustomHarnessInput = {
  name: string;
  summary: string;
  instructions: string;
  localRuntimeSecret?: string;
  localRuntimeUrl?: string;
  ownerAddress?: `0x${string}`;
  tools: HarnessTool[];
  allowedActionTypes: string[];
  blockedActionTypes: string[];
  riskRules: string[];
  requiredReports: string[];
};

function readCustomHarnesses(): HarnessTemplate[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawHarnesses = window.localStorage.getItem(customHarnessesKey);
  if (!rawHarnesses) {
    return [];
  }

  try {
    return JSON.parse(rawHarnesses) as HarnessTemplate[];
  } catch {
    return [];
  }
}

function writeCustomHarnesses(harnesses: HarnessTemplate[]) {
  window.localStorage.setItem(customHarnessesKey, JSON.stringify(harnesses));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function normalizeList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function listCustomHarnesses() {
  return readCustomHarnesses();
}

export function getCustomHarness(harnessId: string) {
  return readCustomHarnesses().find((harness) => harness.id === harnessId);
}

export function createCustomHarness(
  input: CreateCustomHarnessInput,
): HarnessTemplate {
  const harnesses = readCustomHarnesses();
  const createdAt = new Date().toISOString();
  const id = `custom-${slugify(input.name) || "harness"}-${Date.now()}` as const;
  const tools: HarnessTool[] = input.tools.length
    ? input.tools
    : [
        {
          id: "get_wallet_balance",
          name: "get_wallet_balance",
          description: "Read the smart wallet balance.",
          kind: "builtin",
          sponsorSurface: "nexora",
        },
      ];

  const harness: HarnessTemplate = {
    id,
    name: input.name.trim(),
    summary: input.summary.trim(),
    instructions: input.instructions.trim(),
    localRuntimeSecret: input.localRuntimeSecret?.trim() || undefined,
    localRuntimeUrl: input.localRuntimeUrl?.trim() || undefined,
    ownerAddress: input.ownerAddress,
    createdAt,
    source: "custom",
    tools,
    allowedActionTypes: normalizeList(input.allowedActionTypes),
    blockedActionTypes: normalizeList(input.blockedActionTypes),
    riskRules: normalizeList(input.riskRules),
    scoringRules: [
      {
        id: "policy-compliance",
        label: "Policy compliance",
        weight: 30,
        description: "Policy decision and configured limits.",
      },
      {
        id: "risk-score",
        label: "Risk score",
        weight: 30,
        description: "Deterministic risk score for the proposed action.",
      },
      {
        id: "tool-use",
        label: "Tool use",
        weight: 25,
        description: "Required tool calls completed successfully.",
      },
      {
        id: "outcome",
        label: "Outcome",
        weight: 15,
        description: "Objective result quality.",
      },
    ],
    executionPermissions: ["intent_proposal_only", "requires_policy_pass"],
    requiredReports: normalizeList(input.requiredReports),
  };

  writeCustomHarnesses([harness, ...harnesses]);
  return harness;
}
