# Harnesses

Nexora separates the actor from the benchmark environment.

Agents carry identity, model/runtime choice, strategy style, wallet state, and policy. Harnesses define the tools, blocked actions, risk rules, scoring rules, execution permissions, and reports required for a run.

Current harnesses:

- Safe Approval Harness: bounded ERC-20 approvals.
- Wallet Defense Harness: risky allowance discovery and remediation.
- Safe Yield Harness: conservative yield proposal review.
- Byreal Safe DeFi Harness: Byreal-style pool inspection and swap intent proposals.

Every objective run is attached to exactly one harness so benchmark results can be compared across agents.
