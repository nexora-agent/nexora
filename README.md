# Nexora

**Nexora is a verifiable safety layer for on-chain AI agents.**

Users create AI agents, give them limited smart wallets, define safety policies, let them propose on-chain actions, store risk reports on-chain, and turn execution history into agent reputation.

## MVP Loop

```text
Create agent
-> Create wallet
-> Set policy
-> Propose action
-> Analyze risk
-> Store report
-> Execute/block
-> Update reputation
```

## Delivery 1 Scope

This repository contains the foundation for the hackathon build:

- Monorepo with web, API, contracts, shared types, and docs.
- Nexora landing page with the core product story.
- Demo route showing the planned end-to-end user journey.
- Docs route with local setup and architecture links.
- Mantle network constants.
- Placeholder Solidity contracts that compile with Foundry.
- Initial user-facing E2E tests for the web foundation.

## Delivery 2 Scope

The web app now includes the first wallet-ready user path:

- MetaMask/injected wallet connection through Wagmi and Viem.
- Mantle Sepolia chain configuration.
- Owner wallet status card.
- Wrong-network detection and switch flow.
- Disconnect/reset state.
- Browser E2E tests that mock MetaMask for repeatable CI-style coverage.

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

Compile contracts:

```bash
pnpm contracts:build
```

Run web E2E tests:

```bash
pnpm --filter @nexora/web exec playwright install chromium
pnpm --filter @nexora/web test:e2e
```

The wallet E2E tests do not require the real MetaMask extension. They inject a
mock EIP-1193 provider into Playwright and verify the same user-facing states.

## Delivery 3 Scope

Nexora now has the first agent identity layer:

- `NexoraAgentIdentity.sol` registers agent IDs with owner and metadata URI.
- Foundry tests cover registration, owner lookup, metadata validation, and owner-only updates.
- `/create-agent` lets a connected Mantle wallet create a local MVP agent profile.
- `/agents/[agentId]` shows the agent ID, owner, goal, risk mode, and metadata URI.
- Browser tests cover create, view, invalid name, and non-owner view-only behavior.

The web app stores Delivery 3 demo agents in browser `localStorage` until the
frontend is wired to deployed contract addresses in later deliveries.

If Playwright reports missing Linux libraries, install the browser
dependencies for the local machine:

```bash
pnpm --filter @nexora/web exec playwright install-deps chromium
```

## Apps

- `apps/web`: Next.js interface for the user journey.
- `apps/api`: Fastify API skeleton for health checks and future risk analysis.
- `contracts`: Foundry Solidity workspace.
- `packages/shared`: Shared TypeScript types and demo constants.
- `docs`: Concept, architecture, and demo script.

## Current Demo Story

A judge should understand the product from the first screen:

```text
Create an AI agent.
Give it a limited smart wallet.
Set safety rules.
Let it propose actions.
Record reputation on-chain.
```
# nexora
