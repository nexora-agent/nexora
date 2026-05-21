// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "./NexoraAgentIdentity.sol";

/// @notice Stores safety policies for Nexora agents.
contract NexoraPolicy {
    NexoraAgentIdentity public immutable identity;

    struct Policy {
        uint8 maxRiskScore;
        uint256 maxTransactionSizeUsd;
        bool blockUnlimitedApprovals;
        bool blockUnverifiedContracts;
        bool requireRiskReport;
        bool exists;
    }

    mapping(uint256 agentId => Policy policy) private _policies;

    event PolicyUpdated(
        uint256 indexed agentId,
        uint8 maxRiskScore,
        uint256 maxTransactionSizeUsd,
        bool blockUnlimitedApprovals,
        bool blockUnverifiedContracts,
        bool requireRiskReport
    );

    error InvalidRiskScore();
    error NotAgentOwner();

    constructor(NexoraAgentIdentity identity_) {
        identity = identity_;
    }

    function setPolicy(
        uint256 agentId,
        uint8 maxRiskScore,
        uint256 maxTransactionSizeUsd,
        bool blockUnlimitedApprovals,
        bool blockUnverifiedContracts,
        bool requireRiskReport
    ) external {
        if (maxRiskScore > 100) {
            revert InvalidRiskScore();
        }

        if (identity.ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner();
        }

        _policies[agentId] = Policy({
            maxRiskScore: maxRiskScore,
            maxTransactionSizeUsd: maxTransactionSizeUsd,
            blockUnlimitedApprovals: blockUnlimitedApprovals,
            blockUnverifiedContracts: blockUnverifiedContracts,
            requireRiskReport: requireRiskReport,
            exists: true
        });

        emit PolicyUpdated(
            agentId,
            maxRiskScore,
            maxTransactionSizeUsd,
            blockUnlimitedApprovals,
            blockUnverifiedContracts,
            requireRiskReport
        );
    }

    function getPolicy(uint256 agentId) external view returns (Policy memory) {
        Policy memory policy = _policies[agentId];
        if (policy.exists) {
            return policy;
        }

        return Policy({
            maxRiskScore: 60,
            maxTransactionSizeUsd: 20,
            blockUnlimitedApprovals: true,
            blockUnverifiedContracts: true,
            requireRiskReport: true,
            exists: false
        });
    }
}
