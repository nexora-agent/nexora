# Demo Script

## Delivery 1 Script

1. Open the Nexora web app.
2. Confirm the homepage says: "Verifiable safety layer for on-chain AI agents."
3. Confirm the wallet CTA is visible.
4. Open `/demo`.
5. Review the planned agent profile, safety policy, and end-to-end path.
6. Open `/docs`.
7. Confirm setup and architecture docs are listed.

## Delivery 2 Script

1. Open the Nexora web app.
2. Click `Connect MetaMask`.
3. Confirm the owner wallet card shows the connected address.
4. If MetaMask is on another network, click `Switch to Mantle`.
5. Confirm the wallet status changes to `Ready`.
6. Click `Disconnect`.
7. Confirm the wallet card resets to disconnected state.

## Delivery 3 Script

1. Connect MetaMask on Mantle Sepolia.
2. Open `/create-agent`.
3. Keep the default profile or enter:
   - Agent Name: `YieldGuard-01`
   - Goal: `Safe DeFi activity on Mantle`
   - Risk Mode: `Conservative`
4. Click `Create Agent`.
5. Confirm `/agents/1` shows:
   - Agent ID
   - Owner wallet
   - Metadata URI
   - Risk mode
6. Open the same profile with another wallet.
7. Confirm the profile is view-only.

## Delivery 4 Script

1. Create an agent.
2. Open the agent profile.
3. Click `Create Agent Wallet`.
4. Confirm the agent wallet card shows `Deployed`.
5. Click `Show Existing Wallet`.
6. Confirm the same wallet remains linked.
7. Open the profile with another wallet.
8. Confirm the other wallet cannot create or control the agent wallet.

## Delivery 5 Script

1. Create an agent.
2. Open the agent profile.
3. Review the active conservative policy.
4. Change max risk score and max transaction size.
5. Toggle one policy rule.
6. Click `Save Policy`.
7. Refresh the page and confirm the same policy appears.
8. Enter an invalid risk score such as `200`.
9. Confirm the UI rejects the policy.
10. Open the profile with another wallet and confirm policy editing is blocked.

## Delivery 6 Script

1. Create an agent.
2. Create its agent wallet.
3. In the intent builder, enter:
   - `Send 10 USDC to 0x0000000000000000000000000000000000000003`
4. Click `Build Intent`.
5. Confirm the preview shows transfer type, target, amount, calldata, and intent hash.
6. Change the task to:
   - `Approve 20 USDC to 0x0000000000000000000000000000000000000004`
7. Confirm the preview shows approval type.
8. Enter an invalid address and confirm intent creation is blocked.

## Delivery 7 Script

1. Create an agent.
2. Create its agent wallet.
3. Keep the conservative policy active.
4. In the intent builder, enter:
   - `Approve 20 USDC to 0x0000000000000000000000000000000000000004`
5. Click `Build Intent`.
6. Confirm the risk report shows:
   - `Risk Score: 28 / 100`
   - `Policy Result: Passed`
   - `Limited approval amount`
7. Change the task to:
   - `Approve unlimited USDC to 0x0000000000000000000000000000000000000004`
8. Confirm the risk report shows:
   - `Risk Score: 85 / 100`
   - `Policy Result: Blocked`
   - `Unlimited approval detected`
9. Change the task to an unverified target:
   - `Send 10 USDC to 0x0000000000000000000000000000000000000005`
10. Confirm the report raises the unverified-contract flag and blocks under the conservative policy.

## Final MVP Script

1. Connect wallet on Mantle.
2. Create `YieldGuard-01`.
3. Deploy the agent smart wallet.
4. Set a conservative policy.
5. Propose a safe ERC-20 transfer.
6. Analyze risk and store the report on-chain.
7. Execute the safe action.
8. Propose an unlimited approval to an unknown contract.
9. Watch Nexora block the action.
10. Open reputation and report proof.
