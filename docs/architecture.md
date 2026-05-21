# Architecture

```text
apps/web
  User interface for the Nexora journey.

apps/api
  Risk analysis API and future AI explanation service.

contracts
  Mantle smart contracts for identity, wallets, policy, reports, and reputation.

packages/shared
  Shared TypeScript types, demo constants, and future hashing utilities.
```

## Delivery 1 Boundaries

The initial implementation is intentionally a foundation:

- Web routes: `/`, `/demo`, `/docs`
- API route: `/health`
- Contract placeholders: identity, wallet, factory
- Mantle Sepolia config constants

## Delivery 2 Wallet Layer

The web app uses Wagmi, Viem, and React Query for wallet state.

```text
AppProviders
-> WagmiProvider
-> ConnectWalletButton
-> useWalletConnection
-> OwnerWalletCard
-> NetworkSwitcher
```

Supported user-facing states:

- Disconnected: user sees `Connect MetaMask`.
- Connected on Mantle Sepolia: user sees owner address, network, and `Ready`.
- Connected on another configured chain: user is asked to switch to Mantle.
- Disconnected after session: wallet card resets to disconnected state.

## Delivery 3 Agent Identity

The contract identity registry is the first durable on-chain module.

```text
NexoraAgentIdentity
-> registerAgent(metadataURI)
-> Agent ID
-> owner address
-> metadata URI
```

The current web flow creates a local MVP profile with the same fields:

```text
/create-agent
-> AgentCreationForm
-> local metadata object
-> ipfs://nexora-local/agent-{id}
-> /agents/{id}
```

This keeps the user journey testable before Delivery 10 deployment addresses
exist. The storage boundary is isolated in `localAgentRegistry.ts` so the later
contract write can replace it cleanly.

## Delivery 4 Agent Smart Wallet

The wallet factory binds each agent identity to one controlled wallet.

```text
NexoraAgentIdentity
-> NexoraFactory.createAgentWallet(agentId)
-> NexoraAgentWallet(owner, agentId)
```

Contract rules:

- Only the agent owner can create the wallet.
- Duplicate creation returns the existing wallet.
- Wallet execution is owner-only.
- The factory tracks `walletOfAgent` and `agentOfWallet`.

Frontend demo flow:

```text
/agents/{id}
-> AgentWalletCard
-> Create Agent Wallet
-> wallet address linked to agent profile
```

The current frontend wallet address is deterministic local demo data. Delivery
10 will replace it with the deployed factory transaction result.

## Delivery 5 Policy System

Policies define what an agent wallet is allowed to do before execution.

```text
NexoraPolicy
-> setPolicy(agentId, rules)
-> owner check via NexoraAgentIdentity
-> getPolicy(agentId)
```

Policy fields:

- Max risk score
- Max transaction size
- Block unlimited approvals
- Block unverified contracts
- Require risk report

Frontend demo flow:

```text
/agents/{id}
-> PolicyEditor
-> PolicyProfileSelector
-> PolicySummaryCard
-> local policy saved to agent profile
```

The same boundary will later be replaced by a contract write to
`NexoraPolicy.setPolicy`.

## Delivery 6 Transaction Intent Builder

The intent layer turns a natural task into structured transaction data before
any execution is possible.

```text
Task text
-> createTransactionIntent
-> ERC-20 calldata
-> deterministic intent hash
-> transaction preview
```

Supported intents:

- ERC-20 transfer
- ERC-20 approval

Shared utility:

```text
packages/shared/src/utils/hashIntent.ts
```

API routes:

```text
POST /analyze-task
POST /analyze-intent
```

Frontend:

```text
/agents/{id}
-> IntentBuilder
-> TaskInputBox
-> TransactionIntentCard
```

## Delivery 7 Risk Engine + AI Explanation

The risk layer analyzes a structured intent before the wallet can execute it.
The score is deterministic and inspectable; the explanation is generated from
the resulting flags and policy decision.

```text
TransactionIntent
-> evaluateRiskRules
-> calculateRiskScore
-> resolvePolicyDecision
-> explainRisk
-> RiskReport
```

Rules currently covered:

- ERC-20 transfer baseline risk
- ERC-20 approval baseline risk
- Limited approval recognition
- Unlimited approval detection
- Demo verified-contract check
- Transaction-size policy check

API route:

```text
POST /analyze-risk
```

Frontend:

```text
/agents/{id}
-> IntentBuilder
-> analyzeRiskLocally
-> RiskReportPanel
-> RiskScoreCard
-> PolicyDecisionCard
-> RiskFlagsList
-> AiExplanationCard
```

## Target MVP Data Flow

```text
User task
-> Structured transaction intent
-> Deterministic risk engine
-> AI explanation
-> On-chain risk report hash
-> Policy-gated wallet execution
-> Reputation update
```
