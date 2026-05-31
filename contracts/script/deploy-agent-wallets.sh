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
ENTRYPOINT_ADDRESS="${NEXORA_ENTRYPOINT_ADDRESS:-}"
NETWORK_NAME="${NETWORK_NAME:-mantle-sepolia}"
ZERO_ADDRESS="0x0000000000000000000000000000000000000000"

if [[ -z "$RPC_URL" ]]; then
  echo "MANTLE_RPC_URL is required."
  exit 1
fi

if [[ -z "$DEPLOYER_KEY" ]]; then
  echo "PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required."
  exit 1
fi

if [[ -z "$ENTRYPOINT_ADDRESS" ]]; then
  ENTRYPOINT_ADDRESS="$ZERO_ADDRESS"
fi

mkdir -p "$DEPLOYMENTS_DIR"

deployer="$(cast wallet address --private-key "$DEPLOYER_KEY")"
balance_wei="$(cast balance --rpc-url "$RPC_URL" "$deployer")"
deployment_file="$DEPLOYMENTS_DIR/$NETWORK_NAME.json"

echo "Network: $NETWORK_NAME"
echo "Deployer: $deployer"
echo "EntryPoint: $ENTRYPOINT_ADDRESS"
echo "Balance wei: $balance_wei"
if [[ "$ENTRYPOINT_ADDRESS" == "$ZERO_ADDRESS" ]]; then
  echo "Mode: direct executor only (no ERC-4337 EntryPoint configured)"
else
  echo "Mode: ERC-4337 / bundler compatible"
fi

if [[ "$balance_wei" == "0" ]]; then
  echo "Deployer has no native token balance. Fund it with Mantle Sepolia MNT first."
  exit 1
fi

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
    for key in ("deployedTo", "deployed_to", "contractAddress", "address"):
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

    echo "" >&2
    echo "Deploying $label... attempt $attempt/3" >&2
    echo "Contract path: $contract_path" >&2
    echo "Nonce: $nonce" >&2

    if forge create \
      --root "$CONTRACTS_DIR" \
      --rpc-url "$RPC_URL" \
      --private-key "$DEPLOYER_KEY" \
      --nonce "$nonce" \
      --broadcast \
      --json \
      "$contract_path" \
      "$@" \
      >"$tmp_out" 2>"$tmp_err"; then
      echo "Raw stdout for $label:" >&2
      cat "$tmp_out" >&2
      echo "" >&2

      local address
      address="$(extract_address_from_file "$tmp_out")"
      if [[ -z "$address" ]]; then
        echo "ERROR: Could not parse deployed address for $label." >&2
        cat "$tmp_out" >&2
        cat "$tmp_err" >&2
        rm -f "$tmp_out" "$tmp_err"
        exit 1
      fi

      echo "$label deployed at: $address" >&2
      rm -f "$tmp_out" "$tmp_err"
      printf "%s" "$address"
      return 0
    fi

    echo "Attempt $attempt failed for $label." >&2
    cat "$tmp_out" >&2
    cat "$tmp_err" >&2
    rm -f "$tmp_out" "$tmp_err"
    sleep 3
  done

  echo "ERROR: forge create failed for $label after 3 attempts." >&2
  exit 1
}

contract_from_deployment() {
  local contract_name="$1"
  if [[ ! -f "$deployment_file" ]]; then
    printf "%s" "$ZERO_ADDRESS"
    return 0
  fi

  python3 - "$deployment_file" "$contract_name" "$ZERO_ADDRESS" <<'PY'
import json
import re
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
contract_name = sys.argv[2]
zero = sys.argv[3]
value = payload.get("contracts", {}).get(contract_name, zero)
if isinstance(value, str) and re.fullmatch(r"0x[a-fA-F0-9]{40}", value):
    print(value)
else:
    print(zero)
PY
}

safe_vault="$(contract_from_deployment "NexoraSafeVault")"
volatile_vault="$(contract_from_deployment "NexoraVolatileVault")"
risky_vault="$(contract_from_deployment "NexoraRiskyVault")"

identity_registry="$(deploy_contract "NexoraAgentIdentityRegistry" "src/NexoraAgentIdentityRegistry.sol:NexoraAgentIdentityRegistry")"
validation_registry="$(deploy_contract "NexoraAgentValidationRegistry" "src/NexoraAgentValidationRegistry.sol:NexoraAgentValidationRegistry" --constructor-args "$identity_registry")"
reputation_registry="$(deploy_contract "NexoraAgentReputationRegistry" "src/NexoraAgentReputationRegistry.sol:NexoraAgentReputationRegistry" --constructor-args "$identity_registry")"
wallet_factory="$(deploy_contract "Nexora4337WalletFactory" "src/Nexora4337WalletFactory.sol:Nexora4337WalletFactory" --constructor-args "$identity_registry" "$ENTRYPOINT_ADDRESS" "$reputation_registry" "$safe_vault" "$volatile_vault" "$risky_vault")"

echo ""
echo "Authorizing factory as identity controller..."
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  "$identity_registry" \
  "setController(address,bool)" \
  "$wallet_factory" \
  true >/dev/null

python3 - "$deployment_file" \
  "$NETWORK_NAME" \
  "$RPC_URL" \
  "$deployer" \
  "$ENTRYPOINT_ADDRESS" \
  "$identity_registry" \
  "$validation_registry" \
  "$reputation_registry" \
  "$wallet_factory" <<'PY'
import json
import sys
from pathlib import Path

deployment_file = Path(sys.argv[1])
network_name = sys.argv[2]
rpc_url = sys.argv[3]
deployer = sys.argv[4]
entrypoint = sys.argv[5]
identity_registry = sys.argv[6]
validation = sys.argv[7]
reputation = sys.argv[8]
factory = sys.argv[9]

if deployment_file.exists():
    payload = json.loads(deployment_file.read_text())
else:
    payload = {"network": network_name, "rpcUrl": rpc_url, "deployer": deployer, "contracts": {}}

payload["network"] = payload.get("network") or network_name
payload["rpcUrl"] = payload.get("rpcUrl") or rpc_url
payload["deployer"] = payload.get("deployer") or deployer
payload.setdefault("contracts", {})
payload["contracts"]["NexoraEntryPoint"] = entrypoint
payload["contracts"]["NexoraAgentIdentityRegistry"] = identity_registry
payload["contracts"]["NexoraAgentValidationRegistry"] = validation
payload["contracts"]["NexoraAgentReputationRegistry"] = reputation
payload["contracts"]["Nexora4337WalletFactory"] = factory

deployment_file.write_text(json.dumps(payload, indent=2) + "\n")
PY

python3 - "$WEB_DEPLOYMENTS_FILE" \
  "$ENTRYPOINT_ADDRESS" \
  "$identity_registry" \
  "$validation_registry" \
  "$reputation_registry" \
  "$wallet_factory" <<'PY'
import re
import sys
from pathlib import Path

web_file = Path(sys.argv[1])
values = {
    "entryPoint": sys.argv[2],
    "agentIdentityRegistry": sys.argv[3],
    "agentValidationRegistry": sys.argv[4],
    "agentReputationRegistry": sys.argv[5],
    "agent4337WalletFactory": sys.argv[6],
}

source = web_file.read_text()
for key, address in values.items():
    if re.search(rf'{key}:\s*"', source):
        source = re.sub(rf'({key}:\s*")[^"]+(")', rf'\g<1>{address}\2', source)
    else:
        source = source.replace("} as const;", f'  {key}: "{address}",\n}} as const;')
web_file.write_text(source)
PY

echo ""
echo "Agent wallet deployment written to $deployment_file"
echo "Frontend contract constants updated in $WEB_DEPLOYMENTS_FILE"
