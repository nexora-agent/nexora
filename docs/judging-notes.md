# Judging Notes

## How to judge Nexora

- **Hosted Preview Mode** (public Vercel app): deterministic browser preview
  with banner, tool trace, risk report, benchmark score, report hash, and
  recorded Mantle proof links. No private keys, no live transactions.
- **Local Live Mode** (local operator runner): model + MCP tools + executor
  key, live Mantle transactions. Shown in the demo video and reproducible from
  the docs.

Judge flow: open the Vercel URL, read the hosted preview banner, click
`Run Hosted Preview`, inspect the tool trace / risk score / benchmark score /
report hash, open Recorded Mantle Proofs, then watch the demo video for the
live local runner execution.

Nexora focuses on three sponsor-aligned surfaces.

Mantle:

- Smart wallet deployment path.
- On-chain risk and benchmark registry.
- Policy-gated execution.
- Reputation registry.

Byreal / RealClaw:

- Byreal Safe DeFi Harness.
- Byreal-style agent tools.
- Read-only pool inspection and bounded intent proposals.

Mirana Ventures / Alpha & Data:

- Risk scores.
- Benchmark scores.
- Arena comparisons.
- Reputation derived from objective history.

The full demo loop is:

Agent -> Harness -> Tools -> Objective -> Proposal -> Risk score -> Registry report -> Policy-gated execution -> Benchmark score -> Reputation -> Arena comparison.
