#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
DEPLOYMENTS_DIR="$ROOT_DIR/deployments"
WEB_DEPLOYMENTS_FILE="$ROOT_DIR/apps/web/src/lib/contracts/deployments.ts"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

RPC_URL="${MANTLE_RPC_URL:-}"
DEPLOYER_KEY="${PRIVATE_KEY:-${DEPLOYER_PRIVATE_KEY:-}}"
NETWORK_NAME="${NETWORK_NAME:-mantle-sepolia}"
ZERO_ADDRESS="0x0000000000000000000000000000000000000000"
deployment_file="$DEPLOYMENTS_DIR/$NETWORK_NAME.json"

if [[ -z "$RPC_URL" ]]; then
  echo "MANTLE_RPC_URL is required."
  exit 1
fi

if [[ -z "$DEPLOYER_KEY" ]]; then
  echo "PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required."
  exit 1
fi

mkdir -p "$DEPLOYMENTS_DIR"

deployer="$(cast wallet address --private-key "$DEPLOYER_KEY")"
identity_registry="$(
  python3 - "$deployment_file" "$ZERO_ADDRESS" <<'PY'
import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
zero = sys.argv[2]
if not path.exists():
    print(zero)
    raise SystemExit(0)
value = json.loads(path.read_text()).get("contracts", {}).get("NexoraAgentIdentityRegistry", zero)
print(value if isinstance(value, str) and re.fullmatch(r"0x[a-fA-F0-9]{40}", value) else zero)
PY
)"

if [[ "$identity_registry" == "$ZERO_ADDRESS" ]]; then
  echo "NexoraAgentIdentityRegistry is required in $deployment_file."
  exit 1
fi

echo "Network: $NETWORK_NAME"
echo "Deployer: $deployer"
echo "Identity registry: $identity_registry"
echo "Deploying NexoraBenchmarkRegistry..."

nonce="$(cast nonce --rpc-url "$RPC_URL" "$deployer")"
tmp_out="$(mktemp)"
tmp_err="$(mktemp)"

if ! forge create \
  --root "$CONTRACTS_DIR" \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --nonce "$nonce" \
  --broadcast \
  --json \
  "src/NexoraBenchmarkRegistry.sol:NexoraBenchmarkRegistry" \
  --constructor-args "$identity_registry" \
  >"$tmp_out" 2>"$tmp_err"; then
  cat "$tmp_out"
  cat "$tmp_err" >&2
  rm -f "$tmp_out" "$tmp_err"
  exit 1
fi

benchmark_registry="$(
  python3 - "$tmp_out" <<'PY'
import json
import re
import sys
from pathlib import Path

payload = Path(sys.argv[1]).read_text()
try:
    data = json.loads(payload)
    value = data.get("deployedTo")
    if isinstance(value, str) and re.fullmatch(r"0x[a-fA-F0-9]{40}", value):
        print(value)
        raise SystemExit(0)
except Exception:
    pass
match = re.search(r"0x[a-fA-F0-9]{40}", payload)
if match:
    print(match.group(0))
PY
)"

rm -f "$tmp_out" "$tmp_err"

if [[ -z "$benchmark_registry" ]]; then
  echo "Could not parse NexoraBenchmarkRegistry address."
  exit 1
fi

python3 - "$deployment_file" "$NETWORK_NAME" "$RPC_URL" "$deployer" "$benchmark_registry" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
network = sys.argv[2]
rpc = sys.argv[3]
deployer = sys.argv[4]
benchmark = sys.argv[5]

payload = json.loads(path.read_text()) if path.exists() else {"contracts": {}}
payload["network"] = payload.get("network") or network
payload["rpcUrl"] = rpc
payload["deployer"] = payload.get("deployer") or deployer
payload.setdefault("contracts", {})
payload["contracts"]["NexoraBenchmarkRegistry"] = benchmark
path.write_text(json.dumps(payload, indent=2) + "\n")
PY

python3 - "$WEB_DEPLOYMENTS_FILE" "$benchmark_registry" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
benchmark = sys.argv[2]
source = path.read_text()
if re.search(r'benchmarkRegistry:\s*"', source):
    source = re.sub(r'(benchmarkRegistry:\s*")[^"]+(")', rf'\g<1>{benchmark}\2', source)
else:
    source = source.replace("} as const;", f'  benchmarkRegistry: "{benchmark}",\n}} as const;')
path.write_text(source)
PY

echo "NexoraBenchmarkRegistry deployed at: $benchmark_registry"
echo "Deployment written to $deployment_file"
echo "Frontend constants updated in $WEB_DEPLOYMENTS_FILE"
