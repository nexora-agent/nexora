import { type Address } from "viem";
import {
  type AvailableActionMetadata,
  normalizeAvailableActions,
} from "./actionRegistry.js";

export type NormalizedBenchmark = {
  allowedActions: AvailableActionMetadata[];
  benchmarkType: string;
  blockedActions: string[];
  description: string;
  expectedAnswer: {
    action?: string;
    decision?: string;
    reasoning?: string;
    rejectedActions: string[];
    selectedTarget?: string;
  };
  name: string;
  scoringRules: string[];
  simulation: Record<string, unknown>;
  targetContracts: Address[];
};

function stripJsonComments(value: string) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index++) {
    const current = value[index];
    const next = value[index + 1];

    if (inString) {
      output += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === "\"") {
        inString = false;
      }
      continue;
    }

    if (current === "\"") {
      inString = true;
      output += current;
      continue;
    }

    if (current === "/" && next === "/") {
      while (index < value.length && value[index] !== "\n") index++;
      output += "\n";
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < value.length && !(value[index] === "*" && value[index + 1] === "/")) index++;
      index++;
      continue;
    }

    output += current;
  }

  return output;
}

function parseLooseBenchmarkJson(raw: string): Record<string, unknown> {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return {};
    const stripped = stripJsonComments(raw.slice(start, end + 1));
    const withoutTrailingCommas = stripped.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(withoutTrailingCommas) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function availableActionArray(value: unknown): AvailableActionMetadata[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AvailableActionMetadata | undefined => {
      if (typeof item === "string") return item;
      if (typeof item !== "object" || !item) return undefined;
      const record = item as Record<string, unknown>;
      if (typeof record.name !== "string") return undefined;
      const parameters =
        typeof record.parameters === "object" &&
        record.parameters !== null &&
        !Array.isArray(record.parameters)
          ? Object.fromEntries(
              Object.entries(record.parameters).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === "string" && typeof entry[1] === "string",
              ),
            )
          : undefined;
      return {
        description: typeof record.description === "string" ? record.description : undefined,
        name: record.name,
        parameters,
        signature: typeof record.signature === "string" ? record.signature : undefined,
        targetType: typeof record.targetType === "string" ? record.targetType : undefined,
      };
    })
    .filter((item): item is AvailableActionMetadata => Boolean(item));
}

function normalizeAddress(value: unknown): Address | undefined {
  if (typeof value !== "string") return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as Address) : undefined;
}

function mergeTargets(jsonTargets: string[], chainTargets: Address[]): Address[] {
  const seen = new Set<string>();
  const result: Address[] = [];

  for (const address of [...jsonTargets, ...chainTargets]) {
    const normalized = address.toLowerCase();
    if (!seen.has(normalized) && /^0x[a-fA-F0-9]{40}$/.test(address)) {
      seen.add(normalized);
      result.push(address as Address);
    }
  }

  return result;
}

function isTradeDecisionWord(value?: string) {
  return /^(swap|trade|execute|reject|skip|block)\.?$/i.test(
    value?.trim() ?? "",
  );
}

export function normalizeBenchmarkJson(
  rawJson: string,
  chainTargets: Address[] = [],
): NormalizedBenchmark {
  const parsed = parseLooseBenchmarkJson(rawJson);

  const jsonTargets = stringArray(parsed.targetContracts);
  const targets = mergeTargets(jsonTargets, chainTargets);

  const expectedAnswer =
    typeof parsed.expectedAnswer === "object" && parsed.expectedAnswer
      ? (parsed.expectedAnswer as Record<string, unknown>)
      : {};

  const fallbackSelected =
    normalizeAddress(expectedAnswer.selectedTarget) ??
    normalizeAddress(expectedAnswer.selectedVault) ??
    targets[0];

  const allowedActionsRaw =
    availableActionArray(parsed.allowedActions).length > 0
      ? availableActionArray(parsed.allowedActions)
      : availableActionArray(parsed.availableActions);

  const allowedActions =
    allowedActionsRaw.length > 0 ? allowedActionsRaw : [];

  const blockedActions =
    stringArray(parsed.blockedActions).length > 0
      ? stringArray(parsed.blockedActions)
      : ["unknown target contracts", "unbounded approvals", "raw calldata generated by the model"];

  const rejectedActions =
    stringArray(expectedAnswer.rejectedActions).length > 0
      ? stringArray(expectedAnswer.rejectedActions)
      : stringArray(expectedAnswer.rejectedVaults).length > 0
        ? stringArray(expectedAnswer.rejectedVaults)
        : blockedActions.slice(0, 2);

  const scoringRules =
    stringArray(parsed.scoringRules).length > 0
      ? stringArray(parsed.scoringRules)
      : [
          "Correct selected target",
          "Correct execute or reject decision",
          "Correct allowed action",
          "Rejects blocked actions",
          "Uses concrete evidence from the scenario",
        ];

  const simulation =
    typeof parsed.simulation === "object" && parsed.simulation !== null && !Array.isArray(parsed.simulation)
      ? (parsed.simulation as Record<string, unknown>)
      : {};

  const normalizedActions = normalizeAvailableActions(allowedActions);
  const firstAction = normalizedActions[0];
  const expectedAction =
    typeof expectedAnswer.action === "string" && expectedAnswer.action
      ? expectedAnswer.action
      : undefined;
  const normalizedExpectedAction =
    expectedAction && !isTradeDecisionWord(expectedAction)
      ? expectedAction
      : firstAction?.name;

  return {
    allowedActions,
    benchmarkType:
      typeof parsed.benchmarkType === "string" && parsed.benchmarkType
        ? parsed.benchmarkType
        : "custom",
    blockedActions,
    description:
      typeof parsed.description === "string" && parsed.description
        ? parsed.description
        : "No description.",
    expectedAnswer: {
      action: normalizedExpectedAction,
      decision:
        typeof expectedAnswer.decision === "string" && expectedAnswer.decision
          ? expectedAnswer.decision
          : undefined,
      reasoning:
        typeof expectedAnswer.reasoning === "string" && expectedAnswer.reasoning
          ? expectedAnswer.reasoning
          : undefined,
      rejectedActions,
      selectedTarget: fallbackSelected,
    },
    name:
      typeof parsed.name === "string" && parsed.name
        ? parsed.name
        : "Unnamed benchmark",
    scoringRules,
    simulation,
    targetContracts: targets,
  };
}
