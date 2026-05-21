# Nexora

**Nexora is a Mantle-native benchmark harness and safety layer for on-chain AI agents.**

Users create agents, attach smart wallets, choose benchmark harnesses, run objectives through MCP-style tools, score the resulting proposals, record risk and benchmark reports, gate execution through policy, and turn behavior into reputation.

## Sponsor Focus

Nexora intentionally focuses on three sponsor-aligned surfaces:

- **Mantle:** smart wallets, policy-gated execution, risk registry, benchmark reports, reputation registry.
- **Byreal / RealClaw:** Byreal Safe DeFi Harness with Byreal-style tools for agentic DeFi inspection and bounded intent proposals.
- **Mirana Ventures / Alpha & Data:** risk scoring, benchmark analytics, Arena comparisons, and reputation from performance data.

## Product Loop

```text
Agent
-> Harness
-> MCP-style tools
-> Objective
-> Proposal
-> Risk report
-> Benchmark score
-> On-chain report
-> Policy-gated execute/block
-> Reputation
-> Arena comparison
```

## Implemented Deliveries

- Agent dashboard and profile pages.
- Agent creation wizard.
- Harness templates.
- MCP-style tool runtime.
- Agent smart wallet and funding UX.
- Objective runner.
- Proposal and risk integration.
- Byreal Safe DeFi Harness and adapter.
- Benchmark scoring.
- On-chain risk and benchmark registry contract.
- Policy-gated smart wallet execution.
- Reputation registry contract and UI.
- Nexora Arena for side-by-side agent comparison.
- Project docs for architecture, harnesses, tools, Byreal, scoring, deployment, judging notes, and limitations.

## Apps

- `apps/web`: Next.js frontend for the full demo loop.
- `apps/api`: Fastify API for objective, MCP, risk, and registry services.
- `contracts`: Foundry Solidity workspace.
- `packages/shared`: Shared TypeScript types and utilities.
- `docs`: Project documentation.

## Local Setup

Requirements:

- Node.js 20+
- pnpm 10+
- Foundry

Install dependencies:

```bash
pnpm install
```

Run the frontend:

```bash
pnpm dev:web
```

Run the API:

```bash
pnpm dev:api
```

Run builds and checks:

```bash
pnpm --filter @nexora/api build
pnpm --filter @nexora/shared build
pnpm --filter @nexora/web lint
pnpm --filter @nexora/web build
pnpm contracts:test
```

Run browser tests:

```bash
pnpm --filter @nexora/web exec playwright install chromium
pnpm --filter @nexora/web test:e2e
```

The wallet E2E tests inject a mock EIP-1193 provider, so they do not require the real MetaMask extension.

## Mantle Deployment Shape

Contracts:

- `NexoraAgentIdentity`
- `NexoraFactory`
- `NexoraPolicy`
- `NexoraRiskRegistry`
- `NexoraReputation`

Deployment entrypoint:

```bash
cd contracts
forge script script/DeployNexora.s.sol --rpc-url "$MANTLE_RPC_URL" --broadcast
```

Explorer verification is intentionally left as an operator step because it requires the final broadcast addresses and Mantle Explorer configuration.
