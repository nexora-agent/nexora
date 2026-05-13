// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "../src/NexoraAgentIdentity.sol";

contract NexoraAgentIdentityTest {
    NexoraAgentIdentity private registry;

    function setUp() public {
        registry = new NexoraAgentIdentity();
    }

    function testRegistersAgentWithOwnerAndMetadata() public {
        uint256 agentId = registry.registerAgent("ipfs://agent-1");

        NexoraAgentIdentity.Agent memory agent = registry.getAgent(agentId);

        assert(agentId == 1);
        assert(agent.owner == address(this));
        assert(
            keccak256(bytes(agent.metadataURI)) == keccak256(bytes("ipfs://agent-1"))
        );
    }

    function testTracksAgentsByOwner() public {
        registry.registerAgent("ipfs://agent-1");
        registry.registerAgent("ipfs://agent-2");

        uint256[] memory agentIds = registry.agentsOfOwner(address(this));

        assert(agentIds.length == 2);
        assert(agentIds[0] == 1);
        assert(agentIds[1] == 2);
    }

    function testRejectsEmptyMetadata() public {
        try registry.registerAgent("") {
            revert("expected empty metadata revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testOnlyOwnerCanUpdateMetadata() public {
        uint256 agentId = registry.registerAgent("ipfs://agent-1");
        MetadataAttacker attacker = new MetadataAttacker(registry);

        try attacker.update(agentId, "ipfs://stolen") {
            revert("expected owner revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}

contract MetadataAttacker {
    NexoraAgentIdentity private immutable registry;

    constructor(NexoraAgentIdentity registry_) {
        registry = registry_;
    }

    function update(uint256 agentId, string calldata metadataURI) external {
        registry.updateMetadata(agentId, metadataURI);
    }
}
