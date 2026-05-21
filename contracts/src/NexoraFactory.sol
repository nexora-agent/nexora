// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentWallet} from "./NexoraAgentWallet.sol";
import {NexoraAgentIdentity} from "./NexoraAgentIdentity.sol";

/// @notice Factory that deploys one smart wallet per Nexora agent.
contract NexoraFactory {
    NexoraAgentIdentity public immutable identity;

    mapping(uint256 agentId => address wallet) public walletOfAgent;
    mapping(address wallet => uint256 agentId) public agentOfWallet;

    event AgentWalletCreated(uint256 indexed agentId, address indexed owner, address wallet);

    error NotAgentOwner();

    constructor(NexoraAgentIdentity identity_) {
        identity = identity_;
    }

    function createAgentWallet(uint256 agentId) external returns (address wallet) {
        address agentOwner = identity.ownerOf(agentId);
        if (agentOwner != msg.sender) {
            revert NotAgentOwner();
        }

        wallet = walletOfAgent[agentId];
        if (wallet != address(0)) {
            return wallet;
        }

        wallet = address(new NexoraAgentWallet(msg.sender, agentId));
        walletOfAgent[agentId] = wallet;
        agentOfWallet[wallet] = agentId;

        emit AgentWalletCreated(agentId, msg.sender, wallet);
    }
}
