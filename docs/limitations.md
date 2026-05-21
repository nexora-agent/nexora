# Limitations

This repository is hackathon-grade.

Known limitations:

- The frontend demo stores local agent state in browser storage.
- Byreal integration is currently an adapter, not a live trading integration.
- Wallet balances are demo-mode values unless connected to live services.
- Contract deployment and explorer verification still need real network credentials.
- Smart wallet execution should be audited before production use.
- Benchmark scoring is deterministic and transparent, but not yet calibrated against a large external dataset.

These limits are intentional for the MVP. The architecture keeps adapters and services isolated so live sponsor APIs, indexers, and production wallet infrastructure can replace demo implementations cleanly.
