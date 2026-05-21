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
