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
DEPLOYMENT_FILE="$DEPLOYMENTS_DIR/$NETWORK_NAME.json"

if [[ -z "$RPC_URL" ]]; then
  echo "MANTLE_RPC_URL is required."
  exit 1
fi

if [[ -z "$DEPLOYER_KEY" ]]; then
  echo "PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required."
  exit 1
fi

deployer="$(cast wallet address --private-key "$DEPLOYER_KEY")"
balance_wei="$(cast balance --rpc-url "$RPC_URL" "$deployer")"

echo "Network: $NETWORK_NAME"
echo "Deployer: $deployer"
echo "Balance wei: $balance_wei"

if [[ "$balance_wei" == "0" ]]; then
  echo "Deployer has no native token balance. Fund it with Mantle Sepolia MNT first."
  exit 1
fi

mkdir -p "$DEPLOYMENTS_DIR"

extract_address_from_file() {
  local file="$1"

  python3 - "$file" <<'PY'
import json
import re
import sys
from pathlib import Path

payload = Path(sys.argv[1]).read_text().strip()
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
    print(matches[-1])
PY
}

deploy_contract() {
  local label="$1"
  local contract_path="$2"
  shift 2

  for attempt in 1 2 3; do
    local tmp_out
    local tmp_err
    local nonce
    tmp_out="$(mktemp)"
    tmp_err="$(mktemp)"
    nonce="$(cast nonce --rpc-url "$RPC_URL" "$deployer")"

    echo ""
    echo "Deploying $label... attempt $attempt/3"
    echo "Contract path: $contract_path"
    echo "Nonce: $nonce"

    if forge create \
      --root "$CONTRACTS_DIR" \
      --rpc-url "$RPC_URL" \
      --private-key "$DEPLOYER_KEY" \
      --nonce "$nonce" \
      --broadcast \
      "$contract_path" \
      "$@" \
      --json >"$tmp_out" 2>"$tmp_err"; then
      cat "$tmp_out"
      if [[ -s "$tmp_err" ]]; then
        cat "$tmp_err"
      fi

      local address
      address="$(extract_address_from_file "$tmp_out")"
      if [[ -z "$address" ]]; then
        echo "Could not parse deployed address for $label."
        exit 1
      fi

      echo "$label deployed at: $address"
      echo "$address"
      return 0
    fi

    cat "$tmp_err"
    sleep $((attempt * 2))
  done

  echo "Deployment failed for $label."
  exit 1
}

token="$(deploy_contract \
  "NexoraBenchmarkToken" \
  "src/NexoraBenchmarkToken.sol:NexoraBenchmarkToken" \
  --constructor-args "Nexora Benchmark USD" "nUSD" "1000000000000000000000000" "$deployer" | tail -n 1)"

dex="$(deploy_contract \
  "NexoraBenchmarkDex" \
  "src/NexoraBenchmarkDex.sol:NexoraBenchmarkDex" \
  --constructor-args "$token" | tail -n 1)"

liquidity_mnt="${NEXORA_DEX_LIQUIDITY_MNT_WEI:-1000000000000000000}"
liquidity_token="${NEXORA_DEX_LIQUIDITY_TOKEN_WEI:-10000000000000000000000}"

echo ""
echo "Seeding benchmark DEX liquidity..."
cast send "$token" \
  "approve(address,uint256)" "$dex" "$liquidity_token" \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" >/dev/null

cast send "$dex" \
  "addLiquidity(uint256)" "$liquidity_token" \
  --value "$liquidity_mnt" \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" >/dev/null

python3 - "$DEPLOYMENT_FILE" "$WEB_DEPLOYMENTS_FILE" "$NETWORK_NAME" "$RPC_URL" "$deployer" "$token" "$dex" <<'PY'
import json
import re
import sys
from pathlib import Path

deployment_file = Path(sys.argv[1])
web_file = Path(sys.argv[2])
network = sys.argv[3]
rpc_url = sys.argv[4]
deployer = sys.argv[5]
token = sys.argv[6]
dex = sys.argv[7]

if deployment_file.exists():
    payload = json.loads(deployment_file.read_text())
else:
    payload = {"network": network, "rpcUrl": rpc_url, "deployer": deployer, "contracts": {}}

payload["network"] = network
payload["rpcUrl"] = rpc_url
payload["deployer"] = deployer
payload.setdefault("contracts", {})
payload["contracts"]["NexoraBenchmarkToken"] = token
payload["contracts"]["NexoraBenchmarkDex"] = dex
deployment_file.write_text(json.dumps(payload, indent=2) + "\n")

source = web_file.read_text()
for key, address in {"benchmarkToken": token, "benchmarkDex": dex}.items():
    if re.search(rf'{key}:\s*"', source):
        source = re.sub(rf'({key}:\s*")[^"]+(")', rf'\g<1>{address}\2', source)
    else:
        source = source.replace("} as const;", f'  {key}: "{address}",\n}} as const;')
web_file.write_text(source)
PY

echo "Benchmark DEX deployment written to $DEPLOYMENT_FILE"
echo "Frontend contract constants updated in $WEB_DEPLOYMENTS_FILE"
echo "Token: $token"
echo "DEX: $dex"
