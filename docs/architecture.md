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
