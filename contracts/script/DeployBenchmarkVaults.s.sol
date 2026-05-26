// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraRiskyVault} from "../src/NexoraRiskyVault.sol";
import {NexoraSafeVault} from "../src/NexoraSafeVault.sol";
import {NexoraVolatileVault} from "../src/NexoraVolatileVault.sol";

/// @notice Minimal Foundry script shape for the Nexora benchmark vault bundle.
/// @dev The repo's runnable deployment path is contracts/script/deploy-benchmark-vaults.sh.
contract DeployBenchmarkVaults {
    NexoraSafeVault public safeVault;
    NexoraRiskyVault public riskyVault;
    NexoraVolatileVault public volatileVault;

    function run() external {
        safeVault = new NexoraSafeVault();
        riskyVault = new NexoraRiskyVault();
        volatileVault = new NexoraVolatileVault();
    }
}
