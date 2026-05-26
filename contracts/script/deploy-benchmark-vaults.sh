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
FORCE_DEPLOY_VAULTS="${FORCE_DEPLOY_VAULTS:-0}"

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

existing_contract_address() {
  local contract_name="$1"

  python3 - "$DEPLOYMENT_FILE" "$contract_name" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
contract_name = sys.argv[2]

if not path.exists():
    raise SystemExit(0)

try:
    deployment = json.loads(path.read_text())
except Exception:
    raise SystemExit(0)

value = deployment.get("contracts", {}).get(contract_name)
if isinstance(value, str):
    print(value)
PY
}

is_reusable_address() {
  local address="${1:-}"

  if [[ ! "$address" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    return 1
  fi

  case "$address" in
    0x0000000000000000000000000000000000000101) return 1 ;;
    0x0000000000000000000000000000000000000102) return 1 ;;
    0x0000000000000000000000000000000000000103) return 1 ;;
  esac

  return 0
}

write_deployment_files() {
  local safe_vault="$1"
  local risky_vault="$2"
  local volatile_vault="$3"

  python3 - "$DEPLOYMENT_FILE" "$WEB_DEPLOYMENTS_FILE" "$NETWORK_NAME" "$RPC_URL" "$deployer" "$safe_vault" "$risky_vault" "$volatile_vault" <<'PY'
import json
import re
import sys
from pathlib import Path

deployment_file = Path(sys.argv[1])
web_file = Path(sys.argv[2])
network_name = sys.argv[3]
rpc_url = sys.argv[4]
deployer = sys.argv[5]
safe_vault = sys.argv[6]
risky_vault = sys.argv[7]
volatile_vault = sys.argv[8]

if deployment_file.exists():
    deployment = json.loads(deployment_file.read_text())
else:
    deployment = {
        "network": network_name,
        "rpcUrl": rpc_url,
        "deployer": deployer,
        "contracts": {},
    }

deployment["network"] = deployment.get("network") or network_name
deployment["rpcUrl"] = deployment.get("rpcUrl") or rpc_url
deployment["deployer"] = deployment.get("deployer") or deployer
deployment.setdefault("contracts", {})

if safe_vault:
    deployment["contracts"]["NexoraSafeVault"] = safe_vault
if risky_vault:
    deployment["contracts"]["NexoraRiskyVault"] = risky_vault
if volatile_vault:
    deployment["contracts"]["NexoraVolatileVault"] = volatile_vault

deployment_file.write_text(json.dumps(deployment, indent=2) + "\n")

if web_file.exists():
    web_source = web_file.read_text()
    replacements = {
        "safeVault": safe_vault,
        "riskyVault": risky_vault,
        "volatileVault": volatile_vault,
    }

    for key, address in replacements.items():
        if not address:
            continue
        web_source = re.sub(
            rf'({key}:\s*")[^"]+(")',
            rf'\g<1>{address}\2',
            web_source,
        )

    web_file.write_text(web_source)
PY
}

deploy_contract() {
  local label="$1"
  local contract_path="$2"

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
      "$contract_path" \
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

    if [[ "$attempt" != "3" ]]; then
      echo "Retrying after nonce refresh..." >&2
      sleep 3
    fi
  done

  echo "ERROR: forge create failed for $label after 3 attempts." >&2
  exit 1
}

safe_vault_address="${NEXORA_SAFE_VAULT_ADDRESS:-$(existing_contract_address "NexoraSafeVault")}"
risky_vault_address="${NEXORA_RISKY_VAULT_ADDRESS:-$(existing_contract_address "NexoraRiskyVault")}"
volatile_vault_address="${NEXORA_VOLATILE_VAULT_ADDRESS:-$(existing_contract_address "NexoraVolatileVault")}"

if [[ "$FORCE_DEPLOY_VAULTS" != "1" ]] && is_reusable_address "$safe_vault_address"; then
  echo "Using existing NexoraSafeVault: $safe_vault_address"
else
  safe_vault_address="$(deploy_contract "NexoraSafeVault" "src/NexoraSafeVault.sol:NexoraSafeVault")"
  echo "Parsed NexoraSafeVault: $safe_vault_address"
fi
write_deployment_files "$safe_vault_address" "$risky_vault_address" "$volatile_vault_address"

if [[ "$FORCE_DEPLOY_VAULTS" != "1" ]] && is_reusable_address "$risky_vault_address"; then
  echo "Using existing NexoraRiskyVault: $risky_vault_address"
else
  risky_vault_address="$(deploy_contract "NexoraRiskyVault" "src/NexoraRiskyVault.sol:NexoraRiskyVault")"
  echo "Parsed NexoraRiskyVault: $risky_vault_address"
fi
write_deployment_files "$safe_vault_address" "$risky_vault_address" "$volatile_vault_address"

if [[ "$FORCE_DEPLOY_VAULTS" != "1" ]] && is_reusable_address "$volatile_vault_address"; then
  echo "Using existing NexoraVolatileVault: $volatile_vault_address"
else
  volatile_vault_address="$(deploy_contract "NexoraVolatileVault" "src/NexoraVolatileVault.sol:NexoraVolatileVault")"
  echo "Parsed NexoraVolatileVault: $volatile_vault_address"
fi
write_deployment_files "$safe_vault_address" "$risky_vault_address" "$volatile_vault_address"

echo ""
echo "Benchmark vault deployment written to $DEPLOYMENT_FILE"
echo "Frontend contract constants updated in $WEB_DEPLOYMENTS_FILE"
