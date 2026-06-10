Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractsDir = Join-Path $rootDir "contracts"
$deploymentsDir = Join-Path $rootDir "deployments"
$webDeploymentsFile = Join-Path $rootDir "apps\web\src\lib\contracts\deployments.ts"
$zeroAddress = "0x0000000000000000000000000000000000000000"

function Import-DotEnv([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    if ($parts.Length -ne 2) {
      continue
    }

    [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1])
  }
}

function Resolve-ToolPath([string]$relativePath, [string]$commandName) {
  $localPath = Join-Path $rootDir $relativePath
  if (Test-Path -LiteralPath $localPath) {
    return $localPath
  }

  $command = Get-Command $commandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "Could not find $commandName. Install it locally or add it to PATH."
}

function Require-Env([string]$name) {
  $value = [System.Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$name is required."
  }

  return $value
}

function Parse-DeploymentAddress([string]$payload) {
  try {
    $json = $payload | ConvertFrom-Json
    foreach ($key in @("deployedTo", "deployed_to", "contractAddress", "address")) {
      $value = $json.$key
      if ($value -is [string] -and $value -match "^0x[a-fA-F0-9]{40}$") {
        return $value
      }
    }
  } catch {
  }

  $match = [regex]::Match($payload, "0x[a-fA-F0-9]{40}")
  if ($match.Success) {
    return $match.Value
  }

  throw "Could not parse deployed contract address."
}

function Invoke-Cast([string[]]$arguments) {
  $castPath = Resolve-ToolPath "tools\foundry\bin\cast.exe" "cast.exe"
  return (& $castPath @arguments).Trim()
}

function Invoke-DeployContract(
  [string]$label,
  [string]$contractPath,
  [string[]]$constructorArgs,
  [string]$rpcUrl,
  [string]$privateKey,
  [string]$deployer
) {
  $forgePath = Resolve-ToolPath "tools\foundry\bin\forge.exe" "forge.exe"

  for ($attempt = 1; $attempt -le 3; $attempt += 1) {
    $nonce = Invoke-Cast @("nonce", "--rpc-url", $rpcUrl, $deployer)
    Write-Host ""
    Write-Host "Deploying $label... attempt $attempt/3"
    Write-Host "Contract path: $contractPath"
    Write-Host "Nonce: $nonce"

    $args = @(
      "create",
      "--root", $contractsDir,
      "--rpc-url", $rpcUrl,
      "--private-key", $privateKey,
      "--nonce", $nonce,
      "--broadcast",
      "--json",
      $contractPath
    )

    if ($constructorArgs.Count -gt 0) {
      $args += "--constructor-args"
      $args += $constructorArgs
    }

    try {
      $output = & $forgePath @args 2>&1 | Out-String
      Write-Host "Raw stdout for ${label}:"
      Write-Host $output
      $address = Parse-DeploymentAddress $output
      Write-Host "${label} deployed at: $address"
      return $address
    } catch {
      Write-Warning "Attempt $attempt failed for $label."
      Write-Warning ($_ | Out-String)
      Start-Sleep -Seconds 3
    }
  }

  throw "forge create failed for $label after 3 attempts."
}

function Get-ExistingContractAddress([string]$deploymentFile, [string]$contractName) {
  if (-not (Test-Path -LiteralPath $deploymentFile)) {
    return $zeroAddress
  }

  try {
    $payload = Get-Content -LiteralPath $deploymentFile -Raw | ConvertFrom-Json
    $value = $payload.contracts.$contractName
    if ($value -is [string] -and $value -match "^0x[a-fA-F0-9]{40}$") {
      return $value
    }
  } catch {
  }

  return $zeroAddress
}

Import-DotEnv (Join-Path $rootDir ".env")

$rpcUrl = Require-Env "MANTLE_RPC_URL"
$privateKey = [System.Environment]::GetEnvironmentVariable("PRIVATE_KEY")
if ([string]::IsNullOrWhiteSpace($privateKey)) {
  $privateKey = Require-Env "DEPLOYER_PRIVATE_KEY"
}

$entryPointAddress = [System.Environment]::GetEnvironmentVariable("NEXORA_ENTRYPOINT_ADDRESS")
if ([string]::IsNullOrWhiteSpace($entryPointAddress)) {
  $entryPointAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032"
}

$networkName = [System.Environment]::GetEnvironmentVariable("NETWORK_NAME")
if ([string]::IsNullOrWhiteSpace($networkName)) {
  $networkName = "mantle-sepolia"
}

New-Item -ItemType Directory -Force -Path $deploymentsDir | Out-Null

$deployer = Invoke-Cast @("wallet", "address", "--private-key", $privateKey)
$balanceWei = Invoke-Cast @("balance", "--rpc-url", $rpcUrl, $deployer)
$deploymentFile = Join-Path $deploymentsDir "$networkName.json"

Write-Host "Network: $networkName"
Write-Host "Deployer: $deployer"
Write-Host "EntryPoint: $entryPointAddress"
Write-Host "Balance wei: $balanceWei"
if ($entryPointAddress -eq $zeroAddress) {
  Write-Host "Mode: direct executor only (no ERC-4337 EntryPoint configured)"
} else {
  Write-Host "Mode: ERC-4337 / bundler compatible"
}

if ($balanceWei -eq "0") {
  throw "Deployer has no native token balance. Fund it with Mantle Sepolia MNT first."
}

$safeVault = Get-ExistingContractAddress $deploymentFile "NexoraSafeVault"
$volatileVault = Get-ExistingContractAddress $deploymentFile "NexoraVolatileVault"
$riskyVault = Get-ExistingContractAddress $deploymentFile "NexoraRiskyVault"

$identityRegistry = Invoke-DeployContract -label "NexoraAgentIdentityRegistry" -contractPath "src/NexoraAgentIdentityRegistry.sol:NexoraAgentIdentityRegistry" -constructorArgs @() -rpcUrl $rpcUrl -privateKey $privateKey -deployer $deployer
$validationRegistry = Invoke-DeployContract -label "NexoraAgentValidationRegistry" -contractPath "src/NexoraAgentValidationRegistry.sol:NexoraAgentValidationRegistry" -constructorArgs @($identityRegistry) -rpcUrl $rpcUrl -privateKey $privateKey -deployer $deployer
$reputationRegistry = Invoke-DeployContract -label "NexoraAgentReputationRegistry" -contractPath "src/NexoraAgentReputationRegistry.sol:NexoraAgentReputationRegistry" -constructorArgs @($identityRegistry) -rpcUrl $rpcUrl -privateKey $privateKey -deployer $deployer
$walletFactory = Invoke-DeployContract -label "Nexora4337WalletFactory" -contractPath "src/Nexora4337WalletFactory.sol:Nexora4337WalletFactory" -constructorArgs @($identityRegistry, $entryPointAddress, $validationRegistry, $reputationRegistry, $safeVault, $volatileVault, $riskyVault) -rpcUrl $rpcUrl -privateKey $privateKey -deployer $deployer

Write-Host ""
Write-Host "Authorizing factory as identity controller..."
Invoke-Cast @(
  "send",
  "--rpc-url", $rpcUrl,
  "--private-key", $privateKey,
  $identityRegistry,
  "setController(address,bool)",
  $walletFactory,
  "true"
) | Out-Null

if (Test-Path -LiteralPath $deploymentFile) {
  $payload = Get-Content -LiteralPath $deploymentFile -Raw | ConvertFrom-Json
} else {
  $payload = [pscustomobject]@{
    network = $networkName
    rpcUrl = $rpcUrl
    deployer = $deployer
    contracts = [pscustomobject]@{}
  }
}

if (-not $payload.network) { $payload | Add-Member -NotePropertyName "network" -NotePropertyValue $networkName -Force }
if (-not $payload.rpcUrl) { $payload | Add-Member -NotePropertyName "rpcUrl" -NotePropertyValue $rpcUrl -Force }
if (-not $payload.deployer) { $payload | Add-Member -NotePropertyName "deployer" -NotePropertyValue $deployer -Force }
if (-not $payload.contracts) { $payload | Add-Member -NotePropertyName "contracts" -NotePropertyValue ([pscustomobject]@{}) -Force }

$payload.contracts | Add-Member -NotePropertyName "NexoraEntryPoint" -NotePropertyValue $entryPointAddress -Force
$payload.contracts | Add-Member -NotePropertyName "NexoraAgentIdentityRegistry" -NotePropertyValue $identityRegistry -Force
$payload.contracts | Add-Member -NotePropertyName "NexoraAgentValidationRegistry" -NotePropertyValue $validationRegistry -Force
$payload.contracts | Add-Member -NotePropertyName "NexoraAgentReputationRegistry" -NotePropertyValue $reputationRegistry -Force
$payload.contracts | Add-Member -NotePropertyName "Nexora4337WalletFactory" -NotePropertyValue $walletFactory -Force

$payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $deploymentFile

$webSource = Get-Content -LiteralPath $webDeploymentsFile -Raw
$replacements = @{
  entryPoint = $entryPointAddress
  agentIdentityRegistry = $identityRegistry
  agentValidationRegistry = $validationRegistry
  agentReputationRegistry = $reputationRegistry
  agent4337WalletFactory = $walletFactory
}

foreach ($key in $replacements.Keys) {
  $pattern = "(${key}:\s*"")[^""]+("")"
  $replacement = '${1}' + $replacements[$key] + '$2'
  $webSource = [regex]::Replace($webSource, $pattern, $replacement)
}

Set-Content -LiteralPath $webDeploymentsFile -Value $webSource

Write-Host ""
Write-Host "Agent wallet deployment written to $deploymentFile"
Write-Host "Frontend contract constants updated in $webDeploymentsFile"
