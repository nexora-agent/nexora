#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

COMMAND="${1:-help}"
ARGUMENT="${2:-}"
if [[ "$ARGUMENT" == "--" ]]; then
  ARGUMENT="${3:-}"
fi
RPC_URL="${MANTLE_RPC_URL:-https://rpc.sepolia.mantle.xyz}"
MODEL_ENDPOINT="${NEXORA_MODEL_ENDPOINT_URL:-http://127.0.0.1:11434/api/generate}"
MODEL_NAME="${NEXORA_MODEL_NAME:-qwen2.5:7b}"
ACTION_AMOUNT="${NEXORA_AGENT_ACTION_AMOUNT_MNT:-0.01}"
EXECUTOR_MIN_BALANCE_MNT="${NEXORA_AGENT_EXECUTOR_MIN_BALANCE_MNT:-0.01}"
EXECUTOR_TOPUP_MNT="${NEXORA_AGENT_EXECUTOR_TOPUP_MNT:-0.05}"

contract_address() {
  local name="$1"
  node -e "const fs=require('fs'); const path='deployments/mantle-sepolia.json'; const d=JSON.parse(fs.readFileSync(path,'utf8')); console.log((d.contracts && d.contracts['$name']) || '');"
}

require_cast() {
  if ! command -v cast >/dev/null 2>&1; then
    echo "cast was not found. Install Foundry first: curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 1
  fi
}

require_executor_key() {
  if [[ -z "${NEXORA_AGENT_EXECUTOR_PRIVATE_KEY:-}" ]]; then
    echo "NEXORA_AGENT_EXECUTOR_PRIVATE_KEY is missing in .env"
    exit 1
  fi
}

normalize_private_key() {
  local key="$1"
  if [[ "$key" == 0x* ]]; then
    printf "%s" "$key"
  else
    printf "0x%s" "$key"
  fi
}

wei_lt() {
  node -e "process.exit(BigInt(process.argv[1]) < BigInt(process.argv[2]) ? 0 : 1)" "$1" "$2"
}

wei_to_mnt() {
  node -e 'const wei=BigInt(process.argv[1]); const whole=wei/10n**18n; const frac=(wei%10n**18n).toString().padStart(18,"0").replace(/0+$/,""); console.log(frac ? `${whole}.${frac}` : `${whole}`);' "$1"
}

wallet_address_for_agent() {
  local agent_id="$1"
  local factory
  factory="$(contract_address Nexora4337WalletFactory)"
  if [[ -z "$factory" ]]; then
    echo "Nexora4337WalletFactory is missing from deployments/mantle-sepolia.json" >&2
    exit 1
  fi

  cast call --rpc-url "$RPC_URL" "$factory" "walletOfAgent(uint256)(address)" "$agent_id"
}

owner_key_for_agent_setup() {
  local owner_key="${NEXORA_OWNER_PRIVATE_KEY:-${PRIVATE_KEY:-}}"
  if [[ -z "$owner_key" ]]; then
    echo "Set PRIVATE_KEY or NEXORA_OWNER_PRIVATE_KEY in .env so the smart wallet owner can configure autonomy." >&2
    exit 1
  fi
  normalize_private_key "$owner_key"
}

ensure_executor_has_gas() {
  require_cast
  require_executor_key

  local executor_key
  executor_key="$(normalize_private_key "$NEXORA_AGENT_EXECUTOR_PRIVATE_KEY")"
  local executor_address
  executor_address="$(cast wallet address --private-key "$executor_key")"
  local balance_wei
  balance_wei="$(cast balance --rpc-url "$RPC_URL" "$executor_address")"
  local min_wei
  min_wei="$(cast to-wei "$EXECUTOR_MIN_BALANCE_MNT" ether)"

  if ! wei_lt "$balance_wei" "$min_wei"; then
    echo "Executor gas balance ok: $(wei_to_mnt "$balance_wei") MNT"
    return 0
  fi

  local funder_key="${NEXORA_FUNDER_PRIVATE_KEY:-${PRIVATE_KEY:-}}"
  if [[ -z "$funder_key" ]]; then
    echo "Executor needs gas: $(wei_to_mnt "$balance_wei") MNT."
    echo "Set PRIVATE_KEY or NEXORA_FUNDER_PRIVATE_KEY in .env so the testnet funder can top it up."
    exit 1
  fi

  funder_key="$(normalize_private_key "$funder_key")"
  local funder_address
  funder_address="$(cast wallet address --private-key "$funder_key")"
  local funder_balance_wei
  funder_balance_wei="$(cast balance --rpc-url "$RPC_URL" "$funder_address")"
  local topup_wei
  topup_wei="$(cast to-wei "$EXECUTOR_TOPUP_MNT" ether)"

  if wei_lt "$funder_balance_wei" "$topup_wei"; then
    echo "Funder $funder_address does not have enough Mantle Sepolia MNT to top up the executor."
    echo "Funder balance: $(wei_to_mnt "$funder_balance_wei") MNT"
    echo "Required top-up: $EXECUTOR_TOPUP_MNT MNT"
    exit 1
  fi

  echo "Executor needs gas: $(wei_to_mnt "$balance_wei") MNT"
  echo "Sending $EXECUTOR_TOPUP_MNT MNT from testnet funder $funder_address to executor $executor_address..."
  cast send \
    --rpc-url "$RPC_URL" \
    --private-key "$funder_key" \
    "$executor_address" \
    --value "$topup_wei"

  for _ in {1..12}; do
    sleep 2
    balance_wei="$(cast balance --rpc-url "$RPC_URL" "$executor_address")"
    if ! wei_lt "$balance_wei" "$min_wei"; then
      echo "Executor funded: $(wei_to_mnt "$balance_wei") MNT"
      return 0
    fi
  done

  echo "Top-up was sent, but the executor balance is still below $EXECUTOR_MIN_BALANCE_MNT MNT."
  echo "Current executor balance: $(wei_to_mnt "$balance_wei") MNT"
  exit 1
}

ensure_autonomy_setup() {
  require_cast
  require_executor_key

  local agent_id="$1"
  local executor_key
  executor_key="$(normalize_private_key "$NEXORA_AGENT_EXECUTOR_PRIVATE_KEY")"
  local executor_address
  executor_address="$(cast wallet address --private-key "$executor_key")"
  local owner_key
  owner_key="$(owner_key_for_agent_setup)"
  local owner_address
  owner_address="$(cast wallet address --private-key "$owner_key")"
  local identity
  identity="$(contract_address NexoraAgentIdentityRegistry)"
  local validation
  validation="$(contract_address NexoraAgentValidationRegistry)"
  local safe_vault
  safe_vault="$(contract_address NexoraSafeVault)"
  local wallet_address
  wallet_address="$(wallet_address_for_agent "$agent_id")"

  if [[ "$wallet_address" == "0x0000000000000000000000000000000000000000" ]]; then
    echo "Smart wallet not found for agent $agent_id. Create it in the dashboard first."
    exit 1
  fi

  local chain_owner
  chain_owner="$(cast call --rpc-url "$RPC_URL" "$identity" "ownerOf(uint256)(address)" "$agent_id")"
  if [[ "${chain_owner,,}" != "${owner_address,,}" ]]; then
    echo "The .env owner key is not the owner of agent $agent_id."
    echo "Agent owner: $chain_owner"
    echo ".env owner:  $owner_address"
    echo "Use the owning wallet in the UI, or set NEXORA_OWNER_PRIVATE_KEY in .env."
    exit 1
  fi

  local reporter_allowed
  reporter_allowed="$(cast call --rpc-url "$RPC_URL" "$validation" "authorizedReporters(uint256,address)(bool)" "$agent_id" "$executor_address")"
  if [[ "$reporter_allowed" != "true" ]]; then
    echo "Authorizing executor as validation reporter..."
    cast send \
      --rpc-url "$RPC_URL" \
      --private-key "$owner_key" \
      "$validation" \
      "setReporter(uint256,address,bool)" \
      "$agent_id" \
      "$executor_address" \
      true >/dev/null
  fi

  mapfile -t policy < <(cast call --rpc-url "$RPC_URL" "$wallet_address" "executorPolicy()(address,bool,bool,uint256,uint256,uint64)" || true)
  local policy_executor="${policy[0]:-0x0000000000000000000000000000000000000000}"
  local policy_enabled="${policy[1]:-false}"
  local policy_requires_preflight="${policy[2]:-false}"

  if [[ "${policy_executor,,}" != "${executor_address,,}" || "$policy_enabled" != "true" || "$policy_requires_preflight" != "true" ]]; then
    echo "Saving smart wallet executor policy..."
    cast send \
      --rpc-url "$RPC_URL" \
      --private-key "$owner_key" \
      "$wallet_address" \
      "setExecutorPolicy(address,bool,bool,uint256,uint256,uint64)" \
      "$executor_address" \
      true \
      true \
      "$(cast to-wei "${NEXORA_AGENT_MAX_ACTION_MNT:-0.02}" ether)" \
      "$(cast to-wei "${NEXORA_AGENT_DAILY_LIMIT_MNT:-0.10}" ether)" \
      "$(( $(date +%s) + ${NEXORA_AGENT_POLICY_VALID_HOURS:-24} * 60 * 60 ))" >/dev/null
  fi

  local target_allowed
  target_allowed="$(cast call --rpc-url "$RPC_URL" "$wallet_address" "allowedTargets(address)(bool)" "$safe_vault")"
  if [[ "$target_allowed" != "true" ]]; then
    echo "Allowing benchmark vault target..."
    cast send \
      --rpc-url "$RPC_URL" \
      --private-key "$owner_key" \
      "$wallet_address" \
      "setAllowedTarget(address,bool)" \
      "$safe_vault" \
      true >/dev/null
  fi

  local selector_allowed
  selector_allowed="$(cast call --rpc-url "$RPC_URL" "$wallet_address" "allowedTargetSelectors(address,bytes4)(bool)" "$safe_vault" "0xd0e30db0")"
  if [[ "$selector_allowed" != "true" ]]; then
    echo "Allowing benchmark vault deposit selector..."
    cast send \
      --rpc-url "$RPC_URL" \
      --private-key "$owner_key" \
      "$wallet_address" \
      "setAllowedSelector(address,bytes4,bool)" \
      "$safe_vault" \
      "0xd0e30db0" \
      true >/dev/null
  fi
}

print_help() {
  cat <<'EOF'
Nexora manual test helper

Commands:
  pnpm nexora:dev                 Start API and web together
  pnpm nexora:api                 Start the API on port 4000
  pnpm nexora:web                 Start the web app on port 3000
  pnpm nexora:harness             Start the example local harness on port 8787
  pnpm nexora:mcp                 Call the Nexora MCP endpoint through the API
  pnpm nexora:byreal-mcp          Call the Byreal/RealClaw MCP example
  pnpm nexora:ollama              Test the configured Ollama model
  pnpm nexora:status -- <agentId> Show contract, executor, and wallet status
  pnpm nexora:runner -- <agentId> Start the local autonomous runner for one smart wallet

Runner setup:
  If the executor has less than 0.01 MNT, the runner helper sends 0.05 MNT
  from PRIVATE_KEY or NEXORA_FUNDER_PRIVATE_KEY in .env.
  It also authorizes the executor as reporter and allows the benchmark vault
  action from PRIVATE_KEY or NEXORA_OWNER_PRIVATE_KEY in .env.

Typical flow:
  pnpm contracts:deploy:agent-wallets
  pnpm nexora:api
  pnpm nexora:web
  pnpm nexora:ollama
  pnpm nexora:status -- 1
  pnpm nexora:runner -- 1
EOF
}

case "$COMMAND" in
  dev)
    export NEXT_PUBLIC_NEXORA_API_URL="${NEXT_PUBLIC_NEXORA_API_URL:-http://localhost:4000}"
    pnpm dev
    ;;

  api)
    pnpm dev:api
    ;;

  web)
    export NEXT_PUBLIC_NEXORA_API_URL="${NEXT_PUBLIC_NEXORA_API_URL:-http://localhost:4000}"
    pnpm dev:web
    ;;

  harness)
    pnpm dev:local-harness
    ;;

  mcp)
    export NEXORA_MCP_URL="${NEXORA_MCP_URL:-http://127.0.0.1:4000/mcp}"
    node tools/mcp-client-example.mjs
    ;;

  byreal-mcp)
    export NEXORA_MCP_URL="${NEXORA_MCP_URL:-http://127.0.0.1:4000/mcp}"
    node tools/byreal-mcp-example.mjs
    ;;

  ollama)
    echo "Checking Ollama tags at http://127.0.0.1:11434/api/tags"
    curl -fsS http://127.0.0.1:11434/api/tags >/tmp/nexora-ollama-tags.json
    node -e "const d=require('/tmp/nexora-ollama-tags.json'); console.log('Models:', (d.models||[]).map(m=>m.name).join(', '));"
    echo "Testing model: $MODEL_NAME"
    curl -fsS "$MODEL_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"$MODEL_NAME\",\"prompt\":\"Return JSON only: {\\\"status\\\":\\\"ok\\\"}\",\"stream\":false}" \
      | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{const j=JSON.parse(s); console.log(j.response || JSON.stringify(j));});"
    ;;

  status)
    require_cast
    require_executor_key
    AGENT_ID="${ARGUMENT:-${NEXORA_SMART_WALLET_ID:-}}"
    if [[ -z "$AGENT_ID" ]]; then
      echo "Pass an agent id, for example: pnpm nexora:status -- 1"
      exit 1
    fi

    FACTORY="$(contract_address Nexora4337WalletFactory)"
    IDENTITY="$(contract_address NexoraAgentIdentityRegistry)"
    VALIDATION="$(contract_address NexoraAgentValidationRegistry)"
    REPUTATION="$(contract_address NexoraAgentReputationRegistry)"
    PREFLIGHT="$(contract_address NexoraPreflightRegistry)"
    SAFE_VAULT="$(contract_address NexoraSafeVault)"

    if [[ -z "$FACTORY" ]]; then
      echo "Nexora4337WalletFactory is missing from deployments/mantle-sepolia.json"
      exit 1
    fi

    EXECUTOR_ADDRESS="$(cast wallet address --private-key "$NEXORA_AGENT_EXECUTOR_PRIVATE_KEY")"
    WALLET_ADDRESS="$(cast call --rpc-url "$RPC_URL" "$FACTORY" "walletOfAgent(uint256)(address)" "$AGENT_ID" 2>/dev/null || true)"

    echo "Network RPC: $RPC_URL"
    echo "Agent ID: $AGENT_ID"
    echo "Executor: $EXECUTOR_ADDRESS"
    echo "Executor balance: $(cast balance --rpc-url "$RPC_URL" --ether "$EXECUTOR_ADDRESS") MNT"
    echo "Factory: $FACTORY"
    echo "Identity registry: $IDENTITY"
    echo "Validation registry: $VALIDATION"
    echo "Reputation registry: $REPUTATION"
    echo "Preflight registry: $PREFLIGHT"
    echo "Safe benchmark vault: $SAFE_VAULT"

    if [[ -n "$WALLET_ADDRESS" && "$WALLET_ADDRESS" != "0x0000000000000000000000000000000000000000" ]]; then
      echo "Smart wallet: $WALLET_ADDRESS"
      echo "Smart wallet balance: $(cast balance --rpc-url "$RPC_URL" --ether "$WALLET_ADDRESS") MNT"
    else
      echo "Smart wallet: not found for this agent id"
    fi
    ;;

  runner)
    require_cast
    require_executor_key
    AGENT_ID="${ARGUMENT:-${NEXORA_SMART_WALLET_ID:-}}"
    if [[ -z "$AGENT_ID" ]]; then
      echo "Pass an agent id, for example: pnpm nexora:runner -- 1"
      exit 1
    fi

    ensure_executor_has_gas
    ensure_autonomy_setup "$AGENT_ID"

    export MANTLE_RPC_URL="$RPC_URL"
    export NEXORA_AGENT_EXECUTOR_PRIVATE_KEY="$NEXORA_AGENT_EXECUTOR_PRIVATE_KEY"
    export NEXORA_SMART_WALLET_ID="$AGENT_ID"
    export NEXORA_MODEL_ENDPOINT_URL="$MODEL_ENDPOINT"
    export NEXORA_MODEL_NAME="$MODEL_NAME"
    export NEXORA_AGENT_ACTION_AMOUNT_MNT="$ACTION_AMOUNT"
    pnpm agent:runner
    ;;

  help|-h|--help)
    print_help
    ;;

  *)
    echo "Unknown command: $COMMAND"
    print_help
    exit 1
    ;;
esac
