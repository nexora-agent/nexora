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

if [[ -z "$RPC_URL" ]]; then
  echo "MANTLE_RPC_URL is required."
  exit 1
fi

if [[ -z "$DEPLOYER_KEY" ]]; then
  echo "PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required."
  exit 1
fi

deployer="$(cast wallet address --private-key "$DEPLOYER_KEY")"
nonce="$(cast nonce --rpc-url "$RPC_URL" "$deployer")"
deployment_file="$DEPLOYMENTS_DIR/$NETWORK_NAME.json"
smart_wallet_registry_address="${SMART_WALLET_REGISTRY_ADDRESS:-}"

if [[ -z "$smart_wallet_registry_address" && -f "$deployment_file" ]]; then
  smart_wallet_registry_address="$(python3 - "$deployment_file" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
print(payload.get("contracts", {}).get("NexoraSmartWalletRegistry", ""))
PY
)"
fi

if [[ -z "$smart_wallet_registry_address" ]]; then
  echo "SMART_WALLET_REGISTRY_ADDRESS is required, or deployments/$NETWORK_NAME.json must contain NexoraSmartWalletRegistry."
  exit 1
fi

echo "Network: $NETWORK_NAME"
echo "Deployer: $deployer"
echo "Nonce: $nonce"
echo "Smart wallet registry: $smart_wallet_registry_address"
echo "Deploying NexoraPreflightRegistry..."

tmp_out="$(mktemp)"
tmp_err="$(mktemp)"

if ! forge create \
  --root "$CONTRACTS_DIR" \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --nonce "$nonce" \
  --broadcast \
  "src/NexoraPreflightRegistry.sol:NexoraPreflightRegistry" \
  --constructor-args "$smart_wallet_registry_address" \
  --json >"$tmp_out" 2>"$tmp_err"; then
  cat "$tmp_out"
  cat "$tmp_err"
  rm -f "$tmp_out" "$tmp_err"
  exit 1
fi

address="$(python3 - "$tmp_out" <<'PY'
import json
import re
import sys
from pathlib import Path

payload = Path(sys.argv[1]).read_text()
try:
    data = json.loads(payload)
    for key in ("deployedTo", "contractAddress", "address"):
        value = data.get(key)
        if isinstance(value, str) and re.fullmatch(r"0x[a-fA-F0-9]{40}", value):
            print(value)
            raise SystemExit(0)
except Exception:
    pass

matches = re.findall(r"0x[a-fA-F0-9]{40}", payload)
if matches:
    print(matches[0])
PY
)"

rm -f "$tmp_out" "$tmp_err"

if [[ -z "$address" ]]; then
  echo "Could not parse NexoraPreflightRegistry address."
  exit 1
fi

echo "NexoraPreflightRegistry deployed at: $address"

mkdir -p "$DEPLOYMENTS_DIR"
if [[ -f "$deployment_file" ]]; then
  python3 - "$deployment_file" "$address" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
address = sys.argv[2]
payload = json.loads(path.read_text())
payload.setdefault("contracts", {})["NexoraPreflightRegistry"] = address
path.write_text(json.dumps(payload, indent=2) + "\n")
PY
else
  cat > "$deployment_file" <<JSON
{
  "network": "$NETWORK_NAME",
  "rpcUrl": "$RPC_URL",
  "deployer": "$deployer",
  "contracts": {
    "NexoraPreflightRegistry": "$address"
  }
}
JSON
fi

python3 - "$WEB_DEPLOYMENTS_FILE" "$address" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
address = sys.argv[2]
source = path.read_text()
source = re.sub(r'(preflightRegistry:\s*")[^"]+(")', rf'\g<1>{address}\2', source)
path.write_text(source)
PY

echo "Deployment written to $deployment_file"
echo "Frontend contract constants updated in $WEB_DEPLOYMENTS_FILE"
