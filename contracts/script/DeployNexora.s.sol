// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "../src/NexoraAgentIdentity.sol";
import {NexoraFactory} from "../src/NexoraFactory.sol";
import {NexoraPolicy} from "../src/NexoraPolicy.sol";
import {NexoraRiskRegistry} from "../src/NexoraRiskRegistry.sol";
import {NexoraReputation} from "../src/NexoraReputation.sol";

/// @notice Minimal placeholder deploy script shape for later Foundry broadcasts.
contract DeployNexora {
    NexoraAgentIdentity public identity;
    NexoraFactory public factory;
    NexoraPolicy public policy;
    NexoraRiskRegistry public riskRegistry;
    NexoraReputation public reputation;

    function run() external {
        identity = new NexoraAgentIdentity();
        factory = new NexoraFactory(identity);
        policy = new NexoraPolicy(identity);
        riskRegistry = new NexoraRiskRegistry();
        reputation = new NexoraReputation();
    }
}
