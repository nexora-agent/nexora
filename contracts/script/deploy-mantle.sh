#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
DEPLOYMENTS_DIR="$ROOT_DIR/deployments"

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

path = Path(sys.argv[1])
payload = path.read_text().strip()

try:
    data = json.loads(payload)
    for key in ("deployedTo", "deployed_to", "contractAddress", "address"):
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

  local tmp_out
  local tmp_err
  tmp_out="$(mktemp)"
  tmp_err="$(mktemp)"

  echo "" >&2
  echo "Deploying $label..." >&2
  echo "Contract path: $contract_path" >&2

  if forge create \
    --root "$CONTRACTS_DIR" \
    --rpc-url "$RPC_URL" \
    --private-key "$DEPLOYER_KEY" \
    --broadcast \
    "$contract_path" \
    "$@" \
    --json >"$tmp_out" 2>"$tmp_err"; then

    echo "Raw stdout for $label:" >&2
    cat "$tmp_out" >&2
    echo "" >&2

    if [[ -s "$tmp_err" ]]; then
      echo "Raw stderr for $label:" >&2
      cat "$tmp_err" >&2
      echo "" >&2
    fi

    local address
    address="$(extract_address_from_file "$tmp_out")"

    if [[ -z "$address" ]]; then
      echo "ERROR: Could not parse deployed address for $label." >&2
      echo "Full stdout:" >&2
      cat "$tmp_out" >&2
      echo "Full stderr:" >&2
      cat "$tmp_err" >&2
      rm -f "$tmp_out" "$tmp_err"
      exit 1
    fi

    echo "$label deployed at: $address" >&2
    rm -f "$tmp_out" "$tmp_err"
    printf "%s" "$address"
  else
    echo "ERROR: forge create failed for $label." >&2
    echo "Full stdout:" >&2
    cat "$tmp_out" >&2
    echo "Full stderr:" >&2
    cat "$tmp_err" >&2
    rm -f "$tmp_out" "$tmp_err"
    exit 1
  fi
}

identity_address="$(deploy_contract "NexoraAgentIdentity" "src/NexoraAgentIdentity.sol:NexoraAgentIdentity")"
echo "Parsed NexoraAgentIdentity: $identity_address"

factory_address="$(deploy_contract "NexoraFactory" "src/NexoraFactory.sol:NexoraFactory" --constructor-args "$identity_address")"
echo "Parsed NexoraFactory: $factory_address"

policy_address="$(deploy_contract "NexoraPolicy" "src/NexoraPolicy.sol:NexoraPolicy" --constructor-args "$identity_address")"
echo "Parsed NexoraPolicy: $policy_address"

risk_registry_address="$(deploy_contract "NexoraRiskRegistry" "src/NexoraRiskRegistry.sol:NexoraRiskRegistry")"
echo "Parsed NexoraRiskRegistry: $risk_registry_address"

reputation_address="$(deploy_contract "NexoraReputation" "src/NexoraReputation.sol:NexoraReputation")"
echo "Parsed NexoraReputation: $reputation_address"

cat > "$DEPLOYMENTS_DIR/$NETWORK_NAME.json" <<JSON
{
  "network": "$NETWORK_NAME",
  "rpcUrl": "$RPC_URL",
  "deployer": "$deployer",
  "contracts": {
    "NexoraAgentIdentity": "$identity_address",
    "NexoraFactory": "$factory_address",
    "NexoraPolicy": "$policy_address",
    "NexoraRiskRegistry": "$risk_registry_address",
    "NexoraReputation": "$reputation_address"
  }
}
JSON

echo ""
echo "Deployment written to deployments/$NETWORK_NAME.json"
