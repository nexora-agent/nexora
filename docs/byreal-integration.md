# Byreal / RealClaw Integration

The Byreal Safe DeFi Harness is the sponsor-aligned Agentic Wallets & Economy path.

The MVP implementation provides a Byreal-style adapter with read-only pool inspection, bounded swap-intent creation, and Nexora risk scoring. It is intentionally scoped so the project can honestly claim agentic DeFi tool usage without pretending to perform unsupported live protocol actions.

Current flow:

1. Select the Byreal Safe DeFi Harness.
2. Run a DeFi objective.
3. Agent calls Byreal-style pool tools.
4. Agent creates a bounded swap intent.
5. Nexora scores the action with the same risk and benchmark pipeline.

Live Byreal/RealClaw SDK calls can replace the adapter behind the same tool names when the sponsor API surface is stable.
