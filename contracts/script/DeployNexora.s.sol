// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "../src/NexoraAgentIdentity.sol";
import {NexoraFactory} from "../src/NexoraFactory.sol";
import {NexoraPolicy} from "../src/NexoraPolicy.sol";
import {NexoraRiskRegistry} from "../src/NexoraRiskRegistry.sol";
import {NexoraReputation} from "../src/NexoraReputation.sol";
import {NexoraSmartWalletRegistry} from "../src/NexoraSmartWalletRegistry.sol";
import {NexoraSafeVault} from "../src/NexoraSafeVault.sol";
import {NexoraRiskyVault} from "../src/NexoraRiskyVault.sol";
import {NexoraVolatileVault} from "../src/NexoraVolatileVault.sol";

/// @notice Minimal placeholder deploy script shape for later Foundry broadcasts.
contract DeployNexora {
    NexoraAgentIdentity public identity;
    NexoraFactory public factory;
    NexoraPolicy public policy;
    NexoraRiskRegistry public riskRegistry;
    NexoraReputation public reputation;
    NexoraSmartWalletRegistry public smartWalletRegistry;
    NexoraSafeVault public safeVault;
    NexoraRiskyVault public riskyVault;
    NexoraVolatileVault public volatileVault;

    function run() external {
        identity = new NexoraAgentIdentity();
        factory = new NexoraFactory(identity);
        policy = new NexoraPolicy(identity);
        riskRegistry = new NexoraRiskRegistry();
        reputation = new NexoraReputation();
        smartWalletRegistry = new NexoraSmartWalletRegistry();
        safeVault = new NexoraSafeVault();
        riskyVault = new NexoraRiskyVault();
        volatileVault = new NexoraVolatileVault();
    }
}
