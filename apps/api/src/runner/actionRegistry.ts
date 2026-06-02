import {
  encodeFunctionData,
  keccak256,
  parseEther,
  toBytes,
  type Address,
  type Hex,
} from "viem";

export type AvailableActionMetadata =
  | string
  | {
      description?: string;
      name: string;
      parameters?: Record<string, string>;
      signature?: string;
      targetType?: string;
    };

export type ActionProposal = {
  action?: string;
  params?: Record<string, unknown>;
  reason?: string;
  reasoning?: string;
  rejectedActions?: string[];
  rejectedVaults?: string[];
  selectedContract?: string;
  selectedTarget?: string;
  selectedVault?: string;
  target?: string;
  targetContract?: string;
  valueMnt?: string;
};

export type ProposalCheck = {
  detail: string;
  name: string;
  passed: boolean;
};

export type NormalizedAction = {
  description: string;
  name: string;
  parameters: Record<string, string>;
  selector: Hex;
  signature: string;
  targetType: string;
};

export type BuiltActionCall = {
  actionName: string;
  checks: ProposalCheck[];
  data: Hex;
  params: Record<string, unknown>;
  selector: Hex;
  signature: string;
  target: Address;
  targetType: string;
  value: bigint;
  valueMnt: string;
};

type ActionDefinition = {
  buildCalldata: (params: Record<string, unknown>) => Hex;
  description: string;
  name: string;
  parameters: Record<string, string>;
  signature: string;
  targetType: string;
};

const benchmarkDexAbi = [
  {
    inputs: [{ internalType: "uint256", name: "minTokenOut", type: "uint256" }],
    name: "swapMntForTokens",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const benchmarkVaultAbi = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const actionDefinitions: Record<string, ActionDefinition> = {
  deposit: {
    buildCalldata: () =>
      encodeFunctionData({
        abi: benchmarkVaultAbi,
        functionName: "deposit",
      }),
    description: "Deposit bounded MNT into an allowed benchmark vault.",
    name: "deposit",
    parameters: {},
    signature: "deposit()",
    targetType: "benchmark-vault",
  },
  swapMntForTokens: {
    buildCalldata: (params) => {
      const rawMinTokenOut =
        params.minTokenOut ?? params.minAmountOut ?? params.minimumTokenOut;

      if (
        rawMinTokenOut === undefined ||
        rawMinTokenOut === null ||
        rawMinTokenOut === ""
      ) {
        throw new Error("swapMntForTokens requires params.minTokenOut.");
      }

      const minTokenOut = BigInt(String(rawMinTokenOut));

      if (minTokenOut < 0n) {
        throw new Error("swapMntForTokens minTokenOut must be non-negative.");
      }

      return encodeFunctionData({
        abi: benchmarkDexAbi,
        functionName: "swapMntForTokens",
        args: [minTokenOut],
      });
    },
    description: "Swap bounded MNT amount for benchmark test tokens.",
    name: "swapMntForTokens",
    parameters: {
      minTokenOut: "uint256",
    },
    signature: "swapMntForTokens(uint256)",
    targetType: "benchmark-dex",
  },
};

function functionSelector(signature: string) {
  return keccak256(toBytes(signature)).slice(0, 10) as Hex;
}

function normalizeActionName(value?: string) {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";

  if (
    normalized === "swap" ||
    normalized.includes("swap") ||
    normalized === "swapmnt" ||
    normalized === "swapmntfortokens" ||
    normalized.includes("swapmntfortokens")
  ) {
    return "swapMntForTokens";
  }

  if (
    normalized === "deposit" ||
    normalized.includes("deposit") ||
    normalized.includes("vaultdeposit")
  ) {
    return "deposit";
  }

  return value?.trim() ?? "";
}

function isActionMetadataObject(
  value: AvailableActionMetadata,
): value is Exclude<AvailableActionMetadata, string> {
  return typeof value === "object" && value !== null && "name" in value;
}

function normalizeActionMetadata(
  action: AvailableActionMetadata,
): NormalizedAction | undefined {
  const name = normalizeActionName(
    typeof action === "string" ? action : action.name,
  );
  const definition = actionDefinitions[name];

  if (!definition) {
    return undefined;
  }

  const signature =
    isActionMetadataObject(action) && action.signature
      ? action.signature
      : definition.signature;

  return {
    description:
      isActionMetadataObject(action) && action.description
        ? action.description
        : definition.description,
    name: definition.name,
    parameters:
      isActionMetadataObject(action) && action.parameters
        ? action.parameters
        : definition.parameters,
    selector: functionSelector(signature),
    signature,
    targetType:
      isActionMetadataObject(action) && action.targetType
        ? action.targetType
        : definition.targetType,
  };
}

export function normalizeAvailableActions(
  availableActions: AvailableActionMetadata[] = [],
) {
  const normalized = availableActions
    .map((action) => normalizeActionMetadata(action))
    .filter((action): action is NormalizedAction => Boolean(action));

  const deduped = new Map<string, NormalizedAction>();

  for (const action of normalized) {
    deduped.set(action.name, action);
  }

  if (deduped.size === 0) {
    const fallback = normalizeActionMetadata({
      name: "deposit",
      signature: "deposit()",
      description: "Deposit bounded MNT into an allowed benchmark vault.",
      parameters: {},
      targetType: "benchmark-vault",
    });

    if (fallback) {
      deduped.set(fallback.name, fallback);
    }
  }

  return Array.from(deduped.values());
}

export function buildActionPromptSection(
  availableActions: AvailableActionMetadata[] = [],
) {
  const actions = normalizeAvailableActions(availableActions);

  return actions
    .map((action) => {
      const parameters =
        Object.keys(action.parameters).length > 0
          ? JSON.stringify(action.parameters)
          : "{}";

      return `- ${action.name}
  signature: ${action.signature}
  selector: ${action.selector}
  targetType: ${action.targetType}
  description: ${action.description}
  parameters: ${parameters}`;
    })
    .join("\n");
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    const inner = fenced[1].trim();

    if (inner.startsWith("{") && inner.endsWith("}")) {
      return inner;
    }
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  return objectMatch?.[0];
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseActionProposal(text: string): ActionProposal {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    throw new Error("Model did not return a JSON action proposal.");
  }

  const parsed = JSON.parse(jsonText) as Record<string, unknown>;

  return {
    action:
      typeof parsed.action === "string"
        ? parsed.action
        : typeof parsed.tool === "string"
          ? parsed.tool
          : undefined,
    params: recordValue(parsed.params ?? parsed.parameters),
    reason:
      typeof parsed.reason === "string"
        ? parsed.reason
        : typeof parsed.rationale === "string"
          ? parsed.rationale
          : undefined,
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : typeof parsed.rationale === "string"
          ? parsed.rationale
          : undefined,
    rejectedActions: stringArray(parsed.rejectedActions),
    rejectedVaults: stringArray(parsed.rejectedVaults),
    selectedContract:
      typeof parsed.selectedContract === "string"
        ? parsed.selectedContract
        : undefined,
    selectedTarget:
      typeof parsed.selectedTarget === "string"
        ? parsed.selectedTarget
        : undefined,
    selectedVault:
      typeof parsed.selectedVault === "string" ? parsed.selectedVault : undefined,
    target: typeof parsed.target === "string" ? parsed.target : undefined,
    targetContract:
      typeof parsed.targetContract === "string"
        ? parsed.targetContract
        : undefined,
    valueMnt:
      typeof parsed.valueMnt === "string"
        ? parsed.valueMnt
        : typeof parsed.value === "string"
          ? parsed.value
          : typeof parsed.valueMNT === "string"
            ? parsed.valueMNT
            : undefined,
  };
}

function getSelectedTarget(proposal: ActionProposal) {
  return (
    proposal.selectedTarget ??
    proposal.targetContract ??
    proposal.selectedContract ??
    proposal.target
  );
}

function isHexAddress(value?: string): value is Address {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function normalizeAddress(value: string) {
  return value.toLowerCase();
}

function parseMntValue(value: string, fieldName: string) {
  try {
    return parseEther(value);
  } catch {
    throw new Error(`${fieldName} must be a valid MNT amount.`);
  }
}

function createCheck(name: string, passed: boolean, detail: string) {
  return { detail, name, passed } satisfies ProposalCheck;
}

export function buildSafeActionCall({
  allowedTargets,
  availableActionsMetadata,
  fallbackTarget,
  fallbackValueMnt,
  maxValueMnt,
  proposal,
}: {
  allowedTargets: readonly Address[];
  availableActionsMetadata: AvailableActionMetadata[];
  fallbackTarget: Address;
  fallbackValueMnt: string;
  maxValueMnt: string;
  proposal: ActionProposal;
}): BuiltActionCall {
  const checks: ProposalCheck[] = [];
  const availableActions = normalizeAvailableActions(availableActionsMetadata);
  const actionName = normalizeActionName(proposal.action);

  const action = availableActions.find((candidate) => candidate.name === actionName);

  if (!action) {
    throw new Error(
      `Unsupported action "${proposal.action ?? "unknown"}". The model must choose one action from the benchmark availableActions list.`,
    );
  }

  checks.push(
    createCheck(
      "Action",
      true,
      `${action.name} is listed in benchmark availableActions.`,
    ),
  );

  const selectedTarget = getSelectedTarget(proposal) ?? fallbackTarget;

  if (!isHexAddress(selectedTarget)) {
    throw new Error("Model selectedTarget must be a valid 0x contract address.");
  }

  const allowedTargetList =
    allowedTargets.length > 0 ? allowedTargets : [fallbackTarget];

  const targetAllowed = allowedTargetList.some(
    (target) => normalizeAddress(target) === normalizeAddress(selectedTarget),
  );

  if (!targetAllowed) {
    throw new Error(
      `Selected target ${selectedTarget} is not one of the active benchmark targets.`,
    );
  }

  checks.push(
    createCheck("Target", true, `${selectedTarget} is an active benchmark target.`),
  );

  const valueMnt = proposal.valueMnt ?? fallbackValueMnt;
  const value = parseMntValue(valueMnt, "valueMnt");
  const maxValue = parseMntValue(maxValueMnt, "maxValueMnt");

  if (value < 0n) {
    throw new Error("valueMnt must be non-negative.");
  }

  if (value > maxValue) {
    throw new Error(
      `valueMnt ${valueMnt} exceeds max allowed value ${maxValueMnt} MNT.`,
    );
  }

  checks.push(
    createCheck(
      "Value",
      true,
      `${valueMnt} MNT is within max allowed value ${maxValueMnt} MNT.`,
    ),
  );

  const definition = actionDefinitions[action.name];

  if (!definition) {
    throw new Error(`No deterministic calldata builder for ${action.name}.`);
  }

  const data = definition.buildCalldata(proposal.params ?? {});
  const selector = data.slice(0, 10) as Hex;

  if (selector !== action.selector) {
    throw new Error(
      `Built selector ${selector} does not match allowed selector ${action.selector}.`,
    );
  }

  checks.push(
    createCheck(
      "Selector",
      true,
      `${selector} matches ${action.signature}.`,
    ),
  );

  return {
    actionName: action.name,
    checks,
    data,
    params: proposal.params ?? {},
    selector,
    signature: action.signature,
    target: selectedTarget,
    targetType: action.targetType,
    value,
    valueMnt,
  };
}
