# MCP-Style Tools

Nexora uses an internal MCP-style registry so agents act through named tools rather than unstructured form output.

Core tools:

- `get_agent_profile`
- `get_harness_config`
- `get_wallet_balance`
- `create_transfer_intent`
- `create_approval_intent`
- `analyze_risk`
- `simulate_intent`

Byreal-aligned tools:

- `get_byreal_pools`
- `inspect_byreal_pool`
- `create_byreal_swap_intent`
- `analyze_byreal_action_risk`

Objective results expose the tool trace so judges can see the agent loop: profile, harness, wallet data, proposal intent, risk analysis, and benchmark score.
