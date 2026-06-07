#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# redeploy-clean-state.sh
# Full clean redeployment of all Nexora contracts on Mantle Sepolia.
# Rewires deployments/mantle-sepolia.json and apps/web/src/lib/contracts/deployments.ts.
# Usage: bash contracts/script/redeploy-clean-state.sh [--seed-demo] [--skip-tests]
# ---------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
DEPLOYMENTS_DIR="$ROOT_DIR/deployments"
WEB_DEPLOYMENTS_FILE="$ROOT_DIR/apps/web/src/lib/contracts/deployments.ts"
DEPLOYMENT_FILE="$DEPLOYMENTS_DIR/mantle-sepolia.json"
RUNNER_CONFIG="$ROOT_DIR/.nexora/runner-config.json"
RUNNER_ARCHIVE_DIR="$ROOT_DIR/.nexora/archive"

SEED_DEMO=false
SKIP_TESTS=false

for arg in "$@"; do
  case "$arg" in
    --seed-demo) SEED_DEMO=true ;;
    --skip-tests) SKIP_TESTS=true ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Load env and confirm network
# ---------------------------------------------------------------------------

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

RPC_URL="${MANTLE_RPC_URL:-}"
DEPLOYER_KEY="${PRIVATE_KEY:-${DEPLOYER_PRIVATE_KEY:-}}"
NETWORK_NAME="mantle-sepolia"
ZERO_ADDRESS="0x0000000000000000000000000000000000000000"
ENTRYPOINT_ADDRESS="${NEXORA_ENTRYPOINT_ADDRESS:-$ZERO_ADDRESS}"

echo ""
echo "========================================"
echo "  Nexora Clean Redeploy — $NETWORK_NAME"
echo "========================================"
echo ""

if [[ -z "$RPC_URL" ]]; then
  echo "ERROR: MANTLE_RPC_URL is not set. Add it to .env."
  exit 1
fi

if [[ -z "$DEPLOYER_KEY" ]]; then
  echo "ERROR: PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) is not set. Add it to .env."
  exit 1
fi

deployer="$(cast wallet address --private-key "$DEPLOYER_KEY")"
balance_wei="$(cast balance --rpc-url "$RPC_URL" "$deployer")"
balance_mnt="$(python3 -c "print(f'{int('$balance_wei') / 1e18:.6f}')")"

echo "RPC:      $RPC_URL"
echo "Deployer: $deployer"
echo "Balance:  $balance_mnt MNT ($balance_wei wei)"
echo ""

if [[ "$balance_wei" == "0" ]]; then
  echo "ERROR: Deployer has zero balance. Fund it with Mantle Sepolia MNT first."
  exit 1
fi

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

extract_address_from_file() {
  python3 - "$1" <<'PY'
import json, re, sys
from pathlib import Path

payload = Path(sys.argv[1]).read_text().strip()
try:
    data = json.loads(payload)
    for key in ("deployedTo", "deployed_to", "contractAddress", "address"):
        v = data.get(key)
        if isinstance(v, str) and re.fullmatch(r"0x[a-fA-F0-9]{40}", v):
            print(v); raise SystemExit(0)
except Exception:
    pass
for pat in (r"Deployed to:\s*(0x[a-fA-F0-9]{40})", r"deployedTo[\"':\s]+(0x[a-fA-F0-9]{40})"):
    m = re.search(pat, payload)
    if m:
        print(m.group(1)); raise SystemExit(0)
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
    local tmp_out tmp_err nonce
    tmp_out="$(mktemp)"
    tmp_err="$(mktemp)"
    nonce="$(cast nonce --rpc-url "$RPC_URL" "$deployer")"

    echo "" >&2
    echo "  -> $label  (attempt $attempt/3, nonce $nonce)" >&2

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

      local address
      address="$(extract_address_from_file "$tmp_out")"

      if [[ -z "$address" ]]; then
        echo "ERROR: Could not parse deployed address for $label." >&2
        cat "$tmp_out" >&2; cat "$tmp_err" >&2
        rm -f "$tmp_out" "$tmp_err"
        exit 1
      fi

      echo "     $label => $address" >&2
      rm -f "$tmp_out" "$tmp_err"
      printf "%s" "$address"
      return 0
    fi

    cat "$tmp_out" >&2; cat "$tmp_err" >&2
    rm -f "$tmp_out" "$tmp_err"
    [[ "$attempt" != "3" ]] && sleep 3
  done

  echo "ERROR: forge create failed for $label after 3 attempts." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# 2. Deploy core legacy contracts (factory, policy, risk, reputation, preflight)
# ---------------------------------------------------------------------------

echo "--- Step 1/6: Core contracts ---"

identity_address="$(deploy_contract \
  "NexoraAgentIdentity" \
  "src/NexoraAgentIdentity.sol:NexoraAgentIdentity")"

factory_address="$(deploy_contract \
  "NexoraFactory" \
  "src/NexoraFactory.sol:NexoraFactory" \
  --constructor-args "$identity_address")"

policy_address="$(deploy_contract \
  "NexoraPolicy" \
  "src/NexoraPolicy.sol:NexoraPolicy" \
  --constructor-args "$identity_address")"

risk_registry_address="$(deploy_contract \
  "NexoraRiskRegistry" \
  "src/NexoraRiskRegistry.sol:NexoraRiskRegistry")"

reputation_address="$(deploy_contract \
  "NexoraReputation" \
  "src/NexoraReputation.sol:NexoraReputation")"

smart_wallet_registry_address="$(deploy_contract \
  "NexoraSmartWalletRegistry" \
  "src/NexoraSmartWalletRegistry.sol:NexoraSmartWalletRegistry")"

preflight_registry_address="$(deploy_contract \
  "NexoraPreflightRegistry" \
  "src/NexoraPreflightRegistry.sol:NexoraPreflightRegistry" \
  --constructor-args "$smart_wallet_registry_address")"

echo ""
echo "--- Step 2/6: Execution target vaults ---"

safe_vault_address="$(deploy_contract \
  "NexoraSafeVault" \
  "src/NexoraSafeVault.sol:NexoraSafeVault")"

risky_vault_address="$(deploy_contract \
  "NexoraRiskyVault" \
  "src/NexoraRiskyVault.sol:NexoraRiskyVault")"

volatile_vault_address="$(deploy_contract \
  "NexoraVolatileVault" \
  "src/NexoraVolatileVault.sol:NexoraVolatileVault")"

# ---------------------------------------------------------------------------
# 3. Deploy agent identity + wallet + benchmark infra (MVP contracts)
# ---------------------------------------------------------------------------

echo ""
echo "--- Step 3/6: Agent identity, validation, reputation, benchmark registries ---"

identity_registry="$(deploy_contract \
  "NexoraAgentIdentityRegistry" \
  "src/NexoraAgentIdentityRegistry.sol:NexoraAgentIdentityRegistry")"

validation_registry="$(deploy_contract \
  "NexoraAgentValidationRegistry" \
  "src/NexoraAgentValidationRegistry.sol:NexoraAgentValidationRegistry" \
  --constructor-args "$identity_registry")"

reputation_registry="$(deploy_contract \
  "NexoraAgentReputationRegistry" \
  "src/NexoraAgentReputationRegistry.sol:NexoraAgentReputationRegistry" \
  --constructor-args "$identity_registry")"

benchmark_registry="$(deploy_contract \
  "NexoraBenchmarkRegistry" \
  "src/NexoraBenchmarkRegistry.sol:NexoraBenchmarkRegistry" \
  --constructor-args "$identity_registry")"

wallet_factory="$(deploy_contract \
  "Nexora4337WalletFactory" \
  "src/Nexora4337WalletFactory.sol:Nexora4337WalletFactory" \
  --constructor-args \
    "$identity_registry" \
    "$ENTRYPOINT_ADDRESS" \
    "$reputation_registry" \
    "$safe_vault_address" \
    "$volatile_vault_address" \
    "$risky_vault_address")"

echo ""
echo "  Authorizing wallet factory as identity controller..."
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  "$identity_registry" \
  "setController(address,bool)" \
  "$wallet_factory" \
  true >/dev/null
echo "  Done."

# ---------------------------------------------------------------------------
# Benchmark token + DEX
# ---------------------------------------------------------------------------

echo ""
echo "--- Step 4/6: Benchmark token and DEX ---"

benchmark_token="$(deploy_contract \
  "NexoraBenchmarkToken" \
  "src/NexoraBenchmarkToken.sol:NexoraBenchmarkToken" \
  --constructor-args \
    "Nexora Benchmark USD" \
    "nUSD" \
    "1000000000000000000000000" \
    "$deployer")"

benchmark_dex="$(deploy_contract \
  "NexoraBenchmarkDex" \
  "src/NexoraBenchmarkDex.sol:NexoraBenchmarkDex" \
  --constructor-args "$benchmark_token")"

liquidity_mnt="${NEXORA_DEX_LIQUIDITY_MNT_WEI:-1000000000000000000}"
liquidity_token="${NEXORA_DEX_LIQUIDITY_TOKEN_WEI:-10000000000000000000000}"

echo "  Seeding DEX liquidity (approve + addLiquidity)..."
cast send "$benchmark_token" \
  "approve(address,uint256)" "$benchmark_dex" "$liquidity_token" \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" >/dev/null

cast send "$benchmark_dex" \
  "addLiquidity(uint256)" "$liquidity_token" \
  --value "$liquidity_mnt" \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" >/dev/null
echo "  DEX seeded."

# ---------------------------------------------------------------------------
# 4. Write deployment artifact
# ---------------------------------------------------------------------------

echo ""
echo "--- Step 5/6: Writing deployment artifact and frontend constants ---"

mkdir -p "$DEPLOYMENTS_DIR"
DEPLOY_TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$DEPLOYMENT_FILE" <<JSON
{
  "network": "$NETWORK_NAME",
  "rpcUrl": "$RPC_URL",
  "deployer": "$deployer",
  "timestamp": "$DEPLOY_TIMESTAMP",
  "contracts": {
    "NexoraAgentIdentity": "$identity_address",
    "NexoraFactory": "$factory_address",
    "NexoraPolicy": "$policy_address",
    "NexoraRiskRegistry": "$risk_registry_address",
    "NexoraReputation": "$reputation_address",
    "NexoraSmartWalletRegistry": "$smart_wallet_registry_address",
    "NexoraPreflightRegistry": "$preflight_registry_address",
    "NexoraSafeVault": "$safe_vault_address",
    "NexoraRiskyVault": "$risky_vault_address",
    "NexoraVolatileVault": "$volatile_vault_address",
    "NexoraEntryPoint": "$ENTRYPOINT_ADDRESS",
    "NexoraAgentIdentityRegistry": "$identity_registry",
    "NexoraAgentValidationRegistry": "$validation_registry",
    "NexoraAgentReputationRegistry": "$reputation_registry",
    "NexoraBenchmarkRegistry": "$benchmark_registry",
    "Nexora4337WalletFactory": "$wallet_factory",
    "NexoraBenchmarkToken": "$benchmark_token",
    "NexoraBenchmarkDex": "$benchmark_dex"
  }
}
JSON

echo "  Written: $DEPLOYMENT_FILE"

# ---------------------------------------------------------------------------
# 5. Update frontend constants
# ---------------------------------------------------------------------------

python3 - \
  "$WEB_DEPLOYMENTS_FILE" \
  "$identity_address" \
  "$identity_registry" \
  "$wallet_factory" \
  "$validation_registry" \
  "$reputation_registry" \
  "$benchmark_dex" \
  "$benchmark_registry" \
  "$benchmark_token" \
  "$ENTRYPOINT_ADDRESS" \
  "$factory_address" \
  "$policy_address" \
  "$preflight_registry_address" \
  "$risk_registry_address" \
  "$reputation_address" \
  "$risky_vault_address" \
  "$safe_vault_address" \
  "$smart_wallet_registry_address" \
  "$volatile_vault_address" <<'PY'
import re, sys
from pathlib import Path

web_file = Path(sys.argv[1])
values = {
    "agentIdentity":          sys.argv[2],
    "agentIdentityRegistry":  sys.argv[3],
    "agent4337WalletFactory": sys.argv[4],
    "agentValidationRegistry":sys.argv[5],
    "agentReputationRegistry":sys.argv[6],
    "benchmarkDex":           sys.argv[7],
    "benchmarkRegistry":      sys.argv[8],
    "benchmarkToken":         sys.argv[9],
    "entryPoint":             sys.argv[10],
    "factory":                sys.argv[11],
    "policy":                 sys.argv[12],
    "preflightRegistry":      sys.argv[13],
    "riskRegistry":           sys.argv[14],
    "reputation":             sys.argv[15],
    "riskyVault":             sys.argv[16],
    "safeVault":              sys.argv[17],
    "smartWalletRegistry":    sys.argv[18],
    "volatileVault":          sys.argv[19],
}

source = web_file.read_text()
for key, address in values.items():
    if re.search(rf'{key}:\s*"', source):
        source = re.sub(rf'({key}:\s*")[^"]+(")', rf'\g<1>{address}\2', source)
    else:
        source = source.replace("} as const;", f'  {key}: "{address}",\n}} as const;')
web_file.write_text(source)
print(f"Updated {web_file}")
PY

# ---------------------------------------------------------------------------
# 6. Clear local project state
# ---------------------------------------------------------------------------

if [[ -f "$RUNNER_CONFIG" ]]; then
  mkdir -p "$RUNNER_ARCHIVE_DIR"
  archive_name="runner-config-pre-redeploy-$DEPLOY_TIMESTAMP.json"
  cp "$RUNNER_CONFIG" "$RUNNER_ARCHIVE_DIR/$archive_name"
  echo "  Archived old runner config -> .nexora/archive/$archive_name"

  python3 - "$RUNNER_CONFIG" "$benchmark_registry" "$identity_registry" "$wallet_factory" <<'PY'
import json, sys
from pathlib import Path

config_path = Path(sys.argv[1])
benchmark_reg  = sys.argv[2]
identity_reg   = sys.argv[3]
wallet_factory = sys.argv[4]

config = json.loads(config_path.read_text())
# Reset agentId so the runner does not reference a stale on-chain agent
config["agentId"] = ""
config_path.write_text(json.dumps(config, indent=2) + "\n")
PY
  echo "  Runner config: agentId cleared (references a stale agent from prior deployment)."
fi

# ---------------------------------------------------------------------------
# 7. Optional seed step
# ---------------------------------------------------------------------------

if [[ "$SEED_DEMO" == "true" ]]; then
  echo ""
  echo "--- Seed: creating sample benchmark (--seed-demo) ---"
  echo "  (Seed step is a placeholder — implement via your API or cast calls here.)"
  echo "  Benchmark registry: $benchmark_registry"
  echo "  Wallet factory:     $wallet_factory"
fi

# ---------------------------------------------------------------------------
# 8. Verification
# ---------------------------------------------------------------------------

if [[ "$SKIP_TESTS" != "true" ]]; then
  echo ""
  echo "--- Step 6/6: Verification ---"
  echo "  Running: pnpm contracts:build"
  (cd "$ROOT_DIR" && pnpm contracts:build)
  echo "  Running: pnpm contracts:test"
  (cd "$ROOT_DIR" && pnpm contracts:test)
else
  echo ""
  echo "  (Tests skipped via --skip-tests)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "========================================"
echo "  Redeploy complete — $DEPLOY_TIMESTAMP"
echo "========================================"
echo ""
echo "Contract addresses:"
echo "  NexoraAgentIdentity          $identity_address"
echo "  NexoraFactory                $factory_address"
echo "  NexoraPolicy                 $policy_address"
echo "  NexoraRiskRegistry           $risk_registry_address"
echo "  NexoraReputation             $reputation_address"
echo "  NexoraSmartWalletRegistry    $smart_wallet_registry_address"
echo "  NexoraPreflightRegistry      $preflight_registry_address"
echo "  NexoraSafeVault              $safe_vault_address"
echo "  NexoraRiskyVault             $risky_vault_address"
echo "  NexoraVolatileVault          $volatile_vault_address"
echo "  NexoraAgentIdentityRegistry  $identity_registry"
echo "  NexoraAgentValidationRegistry $validation_registry"
echo "  NexoraAgentReputationRegistry $reputation_registry"
echo "  NexoraBenchmarkRegistry      $benchmark_registry"
echo "  Nexora4337WalletFactory      $wallet_factory"
echo "  NexoraBenchmarkToken         $benchmark_token"
echo "  NexoraBenchmarkDex           $benchmark_dex"
echo ""
echo "Files updated:"
echo "  $DEPLOYMENT_FILE"
echo "  $WEB_DEPLOYMENTS_FILE"
echo ""
echo "Next steps:"
echo "  pnpm dev:api                             # start API server"
echo "  pnpm dev:web                             # start web dashboard"
echo ""
echo "  Then in the dashboard:"
echo "  1. Create a smart wallet  (uses new factory: $wallet_factory)"
echo "  2. Create a benchmark     (uses new registry: $benchmark_registry)"
echo "  3. Link benchmark to agent"
echo "  4. Run agent"
echo ""
if [[ -n "${SEED_DEMO:-}" ]] && [[ "$SEED_DEMO" == "false" ]]; then
  echo "  Tip: run with --seed-demo to auto-create a sample benchmark on-chain."
  echo ""
fi
