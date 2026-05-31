// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Registry for Nexora agent identities.
contract NexoraAgentIdentity {
    string public constant name = "Nexora Agent Identity";

    struct Agent {
        address owner;
        string metadataURI;
        uint64 createdAt;
    }

    uint256 private _nextAgentId = 1;

    mapping(uint256 agentId => Agent agent) private _agents;
    mapping(address owner => uint256[] agentIds) private _ownerAgents;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
    event AgentMetadataUpdated(uint256 indexed agentId, string metadataURI);

    error EmptyMetadataURI();
    error AgentNotFound();
    error NotAgentOwner();

    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        agentId = _nextAgentId++;
        _agents[agentId] = Agent({owner: msg.sender, metadataURI: metadataURI, createdAt: uint64(block.timestamp)});
        _ownerAgents[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    function updateMetadata(uint256 agentId, string calldata metadataURI) external {
        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        Agent storage agent = _agentOrRevert(agentId);
        if (agent.owner != msg.sender) {
            revert NotAgentOwner();
        }

        agent.metadataURI = metadataURI;
        emit AgentMetadataUpdated(agentId, metadataURI);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return _agentOrRevert(agentId);
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        return _agentOrRevert(agentId).owner;
    }

    function metadataURIOf(uint256 agentId) external view returns (string memory) {
        return _agentOrRevert(agentId).metadataURI;
    }

    function agentsOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }

    function _agentOrRevert(uint256 agentId) private view returns (Agent storage agent) {
        agent = _agents[agentId];
        if (agent.owner == address(0)) {
            revert AgentNotFound();
        }
    }
}
