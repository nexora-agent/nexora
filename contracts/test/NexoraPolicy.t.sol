// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "../src/NexoraAgentIdentity.sol";
import {NexoraPolicy} from "../src/NexoraPolicy.sol";

contract NexoraPolicyTest {
    NexoraAgentIdentity private identity;
    NexoraPolicy private policy;

    function setUp() public {
        identity = new NexoraAgentIdentity();
        policy = new NexoraPolicy(identity);
    }

    function testDefaultPolicyLoads() public view {
        NexoraPolicy.Policy memory loadedPolicy = policy.getPolicy(1);

        assert(loadedPolicy.maxRiskScore == 60);
        assert(loadedPolicy.maxTransactionSizeUsd == 20);
        assert(loadedPolicy.blockUnlimitedApprovals);
        assert(loadedPolicy.blockUnverifiedContracts);
        assert(loadedPolicy.requireRiskReport);
        assert(!loadedPolicy.exists);
    }

    function testAgentOwnerCanSavePolicy() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");

        policy.setPolicy(agentId, 45, 10, true, false, true);
        NexoraPolicy.Policy memory loadedPolicy = policy.getPolicy(agentId);

        assert(loadedPolicy.maxRiskScore == 45);
        assert(loadedPolicy.maxTransactionSizeUsd == 10);
        assert(loadedPolicy.blockUnlimitedApprovals);
        assert(!loadedPolicy.blockUnverifiedContracts);
        assert(loadedPolicy.requireRiskReport);
        assert(loadedPolicy.exists);
    }

    function testRejectsInvalidRiskScore() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");

        try policy.setPolicy(agentId, 101, 20, true, true, true) {
            revert("expected invalid risk score revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsUnauthorizedEdit() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");
        PolicyAttacker attacker = new PolicyAttacker(policy);

        try attacker.setPolicy(agentId) {
            revert("expected owner revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}

contract PolicyAttacker {
    NexoraPolicy private immutable policy;

    constructor(NexoraPolicy policy_) {
        policy = policy_;
    }

    function setPolicy(uint256 agentId) external {
        policy.setPolicy(agentId, 40, 12, true, true, true);
    }
}
