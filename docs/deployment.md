# Deployment

Target network: Mantle Sepolia for hackathon demos, with Mantle mainnet support after the contracts are audited and reviewed.

Contracts:

- `NexoraAgentIdentity`
- `NexoraFactory`
- `NexoraPolicy`
- `NexoraRiskRegistry`
- `NexoraReputation`

Local verification:

```bash
cd contracts
forge test
```

Deployment script:

```bash
cd contracts
forge script script/DeployNexora.s.sol --rpc-url "$MANTLE_RPC_URL" --broadcast
```

Explorer verification should be completed on Mantle Explorer after broadcast. The frontend can then show deployed registry and wallet addresses in the DoraHacks submission.

## Vercel hosted preview deployment

The frontend deploys to Vercel as a safe public preview (no private keys, no
live transactions, deterministic in-browser benchmark preview).

Vercel project settings:

- Framework preset: Next.js
- Root directory: `apps/web`
- Install command: `pnpm install`
- Build command: `pnpm --filter @nexora/web build`
- Output: default Next.js

Required Vercel env vars:

```bash
NEXT_PUBLIC_NEXORA_DEMO_MODE=hosted
NEXT_PUBLIC_NEXORA_HOSTED_PREVIEW=true
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_MANTLE_EXPLORER_URL=https://explorer.sepolia.mantle.xyz
```

Optional recorded proof env vars (from a local live demo run):

```bash
NEXT_PUBLIC_DEMO_AGENT_ID=
NEXT_PUBLIC_DEMO_SMART_WALLET=
NEXT_PUBLIC_DEMO_BENCHMARK_REGISTRY=
NEXT_PUBLIC_DEMO_VALIDATION_TX=
NEXT_PUBLIC_DEMO_EXECUTION_TX=
NEXT_PUBLIC_DEMO_REPUTATION_TX=
NEXT_PUBLIC_DEMO_REPORT_HASH=
```

Do **not** configure `PRIVATE_KEY`, `NEXORA_AGENT_EXECUTOR_PRIVATE_KEY`,
`MANTLE_RPC_URL`, or `NEXORA_RUNNER_API_KEY` in Vercel. The hosted preview has
no server-side execution path and must never hold operator secrets.

## Optional runner API key

For local demos, the runner API can be protected with:

```bash
NEXORA_RUNNER_API_KEY=<random-hex-key>
```

When this variable is set, the frontend must send the same key using the local browser setting:

```js
localStorage.setItem("nexora.runnerApiKey", "<random-hex-key>")
```

The API binds to `127.0.0.1` by default and only allows the local web origin through CORS unless `HOST` or `NEXORA_CORS_ORIGINS` is explicitly changed.
