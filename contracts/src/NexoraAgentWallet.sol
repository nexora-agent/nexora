// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Delivery 1 placeholder for policy-gated agent execution.
contract NexoraAgentWallet {
    address public immutable owner;

    constructor(address initialOwner) {
        owner = initialOwner;
    }
}
