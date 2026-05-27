export const nexoraAgentIdentityAbi = [
  {
    inputs: [{ internalType: "string", name: "metadataURI", type: "string" }],
    name: "registerAgent",
    outputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "nextAgentId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const nexoraFactoryAbi = [
  {
    inputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    name: "createAgentWallet",
    outputs: [{ internalType: "address", name: "wallet", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "walletOfAgent",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const nexoraSmartWalletRegistryAbi = [
  {
    inputs: [],
    name: "EmptyMetadataURI",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidMode",
    type: "error",
  },
  {
    inputs: [],
    name: "NotSmartWalletOwner",
    type: "error",
  },
  {
    inputs: [],
    name: "SmartWalletNotFound",
    type: "error",
  },
  {
    inputs: [
      { internalType: "string", name: "metadataURI", type: "string" },
      { internalType: "bytes32", name: "harnessId", type: "bytes32" },
      { internalType: "uint8", name: "riskMode", type: "uint8" },
      { internalType: "uint8", name: "runnerMode", type: "uint8" },
    ],
    name: "registerSmartWallet",
    outputs: [{ internalType: "uint256", name: "smartWalletId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "smartWalletId", type: "uint256" }],
    name: "createSmartWallet",
    outputs: [{ internalType: "address", name: "wallet", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "smartWalletId", type: "uint256" }],
    name: "getSmartWallet",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "address", name: "wallet", type: "address" },
          { internalType: "string", name: "metadataURI", type: "string" },
          { internalType: "bytes32", name: "harnessId", type: "bytes32" },
          { internalType: "uint8", name: "riskMode", type: "uint8" },
          { internalType: "uint8", name: "runnerMode", type: "uint8" },
          { internalType: "uint64", name: "createdAt", type: "uint64" },
          { internalType: "uint64", name: "walletCreatedAt", type: "uint64" },
        ],
        internalType: "struct NexoraSmartWalletRegistry.SmartWallet",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "smartWalletsOfOwner",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "smartWalletId", type: "uint256" }],
    name: "walletOfSmartWallet",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextSmartWalletId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const nexoraRiskRegistryAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "agentId", type: "uint256" },
      { internalType: "bytes32", name: "harnessId", type: "bytes32" },
      { internalType: "bytes32", name: "objectiveRunId", type: "bytes32" },
      { internalType: "bytes32", name: "intentHash", type: "bytes32" },
      { internalType: "uint16", name: "riskScore", type: "uint16" },
      { internalType: "bool", name: "policyPassed", type: "bool" },
      { internalType: "uint16", name: "benchmarkScore", type: "uint16" },
      { internalType: "bytes32", name: "reportHash", type: "bytes32" },
    ],
    name: "recordReport",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const nexoraPreflightRegistryAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "walletId", type: "uint256" },
      { internalType: "uint16", name: "basicScore", type: "uint16" },
      { internalType: "uint16", name: "adversarialScore", type: "uint16" },
      { internalType: "uint16", name: "externalScore", type: "uint16" },
      { internalType: "uint16", name: "averageScore", type: "uint16" },
      { internalType: "uint16", name: "maxRiskScore", type: "uint16" },
      { internalType: "uint32", name: "freshnessSeconds", type: "uint32" },
    ],
    name: "setPreflightThresholds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "walletId", type: "uint256" }],
    name: "getPreflightThresholds",
    outputs: [
      {
        components: [
          { internalType: "uint16", name: "basicScore", type: "uint16" },
          { internalType: "uint16", name: "adversarialScore", type: "uint16" },
          { internalType: "uint16", name: "externalScore", type: "uint16" },
          { internalType: "uint16", name: "averageScore", type: "uint16" },
          { internalType: "uint16", name: "maxRiskScore", type: "uint16" },
          { internalType: "uint32", name: "freshnessSeconds", type: "uint32" },
          { internalType: "bool", name: "exists", type: "bool" },
        ],
        internalType: "struct NexoraPreflightRegistry.PreflightThresholds",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "walletId", type: "uint256" },
          { internalType: "bytes32", name: "actionIntentHash", type: "bytes32" },
          { internalType: "bytes32", name: "modelHash", type: "bytes32" },
          { internalType: "bytes32", name: "harnessHash", type: "bytes32" },
          { internalType: "bytes32", name: "policyHash", type: "bytes32" },
          { internalType: "bytes32", name: "toolsHash", type: "bytes32" },
          { internalType: "bytes32", name: "suiteHash", type: "bytes32" },
          { internalType: "uint16", name: "basicScore", type: "uint16" },
          { internalType: "uint16", name: "adversarialScore", type: "uint16" },
          { internalType: "uint16", name: "externalScore", type: "uint16" },
          { internalType: "uint16", name: "averageScore", type: "uint16" },
          { internalType: "uint16", name: "maxRiskScore", type: "uint16" },
          { internalType: "bool", name: "passed", type: "bool" },
        ],
        internalType: "struct NexoraPreflightRegistry.PreflightInput",
        name: "input",
        type: "tuple",
      },
    ],
    name: "recordPreflight",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "actionIntentHash", type: "bytes32" }],
    name: "getPreflight",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "walletId", type: "uint256" },
          { internalType: "bytes32", name: "actionIntentHash", type: "bytes32" },
          { internalType: "bytes32", name: "modelHash", type: "bytes32" },
          { internalType: "bytes32", name: "harnessHash", type: "bytes32" },
          { internalType: "bytes32", name: "policyHash", type: "bytes32" },
          { internalType: "bytes32", name: "toolsHash", type: "bytes32" },
          { internalType: "bytes32", name: "suiteHash", type: "bytes32" },
          { internalType: "uint16", name: "basicScore", type: "uint16" },
          { internalType: "uint16", name: "adversarialScore", type: "uint16" },
          { internalType: "uint16", name: "externalScore", type: "uint16" },
          { internalType: "uint16", name: "averageScore", type: "uint16" },
          { internalType: "uint16", name: "maxRiskScore", type: "uint16" },
          { internalType: "bool", name: "passed", type: "bool" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "address", name: "reporter", type: "address" },
        ],
        internalType: "struct NexoraPreflightRegistry.PreflightRecord",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const nexoraAgentWalletAbi = [
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
      { internalType: "bytes32", name: "intentHash", type: "bytes32" },
      { internalType: "uint16", name: "maxRiskScore", type: "uint16" },
      {
        components: [
          { internalType: "bytes32", name: "intentHash", type: "bytes32" },
          { internalType: "uint16", name: "riskScore", type: "uint16" },
          { internalType: "bool", name: "policyPassed", type: "bool" },
          { internalType: "bytes32", name: "reportHash", type: "bytes32" },
        ],
        internalType: "struct NexoraAgentWallet.ExecutionReport",
        name: "report",
        type: "tuple",
      },
    ],
    name: "executeWithRiskReport",
    outputs: [{ internalType: "bytes", name: "result", type: "bytes" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "preflightRegistry", type: "address" },
      { internalType: "address", name: "target", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
      { internalType: "bytes32", name: "actionIntentHash", type: "bytes32" },
      { internalType: "uint16", name: "riskScore", type: "uint16" },
    ],
    name: "executeWithPreflight",
    outputs: [{ internalType: "bytes", name: "result", type: "bytes" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const nexoraReputationAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "agentId", type: "uint256" },
      { internalType: "bool", name: "executed", type: "bool" },
      { internalType: "bool", name: "policyViolation", type: "bool" },
      { internalType: "uint16", name: "riskScore", type: "uint16" },
      { internalType: "uint16", name: "benchmarkScore", type: "uint16" },
    ],
    name: "recordRun",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    name: "getStats",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "benchmarkRuns", type: "uint256" },
          { internalType: "uint256", name: "safeActions", type: "uint256" },
          { internalType: "uint256", name: "blockedActions", type: "uint256" },
          { internalType: "uint256", name: "policyViolations", type: "uint256" },
          { internalType: "uint256", name: "totalRiskScore", type: "uint256" },
          { internalType: "uint256", name: "totalBenchmarkScore", type: "uint256" },
          { internalType: "uint256", name: "trustScore", type: "uint256" },
        ],
        internalType: "struct NexoraReputation.Stats",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
