// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentWallet} from "./NexoraAgentWallet.sol";

/// @notice Delivery 1 placeholder factory for future agent wallets.
contract NexoraFactory {
    event AgentWalletCreated(address indexed owner, address wallet);

    function createAgentWallet() external returns (address wallet) {
        wallet = address(new NexoraAgentWallet(msg.sender));
        emit AgentWalletCreated(msg.sender, wallet);
    }
}
