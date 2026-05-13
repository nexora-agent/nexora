// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "../src/NexoraAgentIdentity.sol";
import {NexoraFactory} from "../src/NexoraFactory.sol";

/// @notice Minimal placeholder deploy script shape for later Foundry broadcasts.
contract DeployNexora {
    NexoraAgentIdentity public identity;
    NexoraFactory public factory;

    function run() external {
        identity = new NexoraAgentIdentity();
        factory = new NexoraFactory();
    }
}
