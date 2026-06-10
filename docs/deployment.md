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
