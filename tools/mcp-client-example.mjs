const endpoint = process.env.NEXORA_MCP_URL ?? "http://127.0.0.1:4001/mcp";

async function rpc(method, params) {
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      id: `${Date.now()}-${Math.random()}`,
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `MCP request failed: ${response.status}`);
  }

  return body.result;
}

const context = {
  agentId: "local-mcp-agent",
  agentName: "Local MCP Agent",
  harnessId: "safe-yield",
  policy: {
    blockUnlimitedApprovals: true,
    blockUnverifiedContracts: true,
    maxRiskScore: 60,
    maxTransactionSizeUsd: 20,
    requireRiskReport: true,
  },
  walletAddress: "0xA7E3b27E7B2EF803AD66aF1B733fC01eAA50ACFe",
};

const state = {};

const init = await rpc("initialize", {});
console.log("initialize:", init.serverInfo);

const list = await rpc("tools/list", { harnessId: context.harnessId });
console.log("tools:", list.tools.map((tool) => tool.name).join(", "));

for (const name of [
  "get_mnt_balance",
  "inspect_nexora_vaults",
  "compare_nexora_vaults",
  "create_mnt_deposit_intent",
  "analyze_risk",
]) {
  const result = await rpc("tools/call", {
    arguments: {
      amount: "0.01",
    },
    context,
    name,
    state,
  });

  Object.assign(state, result.state);
  console.log(`${name}:`, result.result.summary);
}

console.log("intent:", state.intent?.intentHash);
