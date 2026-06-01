// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INexoraBenchmarkIdentityOwner {
    function ownerOf(uint256 agentId) external view returns (address);
    function getApproved(uint256 agentId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/// @notice Stores custom benchmark definitions and the active benchmark selected for each agent.
contract NexoraBenchmarkRegistry {
    INexoraBenchmarkIdentityOwner public immutable identityRegistry;

    struct Benchmark {
        uint256 benchmarkId;
        address owner;
        bytes32 benchmarkHash;
        string metadataURI;
        address[] targetContracts;
        uint8 riskMode;
        bool active;
        uint64 createdAt;
    }

    uint256 private _nextBenchmarkId = 1;

    mapping(uint256 benchmarkId => Benchmark benchmark) private _benchmarks;
    mapping(address owner => uint256[] benchmarkIds) private _benchmarksOfOwner;
    mapping(uint256 agentId => uint256 benchmarkId) public activeBenchmarkOfAgent;

    event BenchmarkRegistered(
        uint256 indexed benchmarkId,
        address indexed owner,
        bytes32 indexed benchmarkHash,
        string metadataURI,
        uint8 riskMode
    );
    event BenchmarkStatusUpdated(uint256 indexed benchmarkId, bool active);
    event AgentBenchmarkSelected(uint256 indexed agentId, uint256 indexed benchmarkId, bytes32 indexed benchmarkHash);

    error BenchmarkNotFound();
    error EmptyBenchmarkHash();
    error EmptyMetadataURI();
    error NotAgentOwner();
    error NotBenchmarkOwner();
    error InactiveBenchmark();

    constructor(address identityRegistry_) {
        identityRegistry = INexoraBenchmarkIdentityOwner(identityRegistry_);
    }

    function registerBenchmark(
        bytes32 benchmarkHash,
        string calldata metadataURI,
        address[] calldata targetContracts,
        uint8 riskMode
    ) external returns (uint256 benchmarkId) {
        if (benchmarkHash == bytes32(0)) {
            revert EmptyBenchmarkHash();
        }

        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        benchmarkId = _nextBenchmarkId++;
        address[] memory targets = new address[](targetContracts.length);
        for (uint256 i = 0; i < targetContracts.length; i++) {
            targets[i] = targetContracts[i];
        }

        _benchmarks[benchmarkId] = Benchmark({
            benchmarkId: benchmarkId,
            owner: msg.sender,
            benchmarkHash: benchmarkHash,
            metadataURI: metadataURI,
            targetContracts: targets,
            riskMode: riskMode,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        _benchmarksOfOwner[msg.sender].push(benchmarkId);

        emit BenchmarkRegistered(benchmarkId, msg.sender, benchmarkHash, metadataURI, riskMode);
    }

    function setBenchmarkActive(uint256 benchmarkId, bool active) external {
        Benchmark storage benchmark = _benchmarkOrRevert(benchmarkId);
        if (benchmark.owner != msg.sender) {
            revert NotBenchmarkOwner();
        }

        benchmark.active = active;
        emit BenchmarkStatusUpdated(benchmarkId, active);
    }

    function selectBenchmarkForAgent(uint256 agentId, uint256 benchmarkId) external {
        Benchmark storage benchmark = _benchmarkOrRevert(benchmarkId);
        if (!benchmark.active) {
            revert InactiveBenchmark();
        }

        if (!_isAgentOwnerOrOperator(agentId, msg.sender)) {
            revert NotAgentOwner();
        }

        activeBenchmarkOfAgent[agentId] = benchmarkId;
        emit AgentBenchmarkSelected(agentId, benchmarkId, benchmark.benchmarkHash);
    }

    function getBenchmark(uint256 benchmarkId) external view returns (Benchmark memory) {
        return _benchmarkOrRevert(benchmarkId);
    }

    function benchmarksOfOwner(address owner) external view returns (uint256[] memory) {
        return _benchmarksOfOwner[owner];
    }

    function getActiveBenchmark(uint256 agentId) external view returns (Benchmark memory) {
        uint256 benchmarkId = activeBenchmarkOfAgent[agentId];
        return _benchmarkOrRevert(benchmarkId);
    }

    function nextBenchmarkId() external view returns (uint256) {
        return _nextBenchmarkId;
    }

    function _benchmarkOrRevert(uint256 benchmarkId) private view returns (Benchmark storage benchmark) {
        benchmark = _benchmarks[benchmarkId];
        if (benchmark.benchmarkId == 0) {
            revert BenchmarkNotFound();
        }
    }

    function _isAgentOwnerOrOperator(uint256 agentId, address caller) private view returns (bool) {
        address owner = identityRegistry.ownerOf(agentId);
        return caller == owner || identityRegistry.getApproved(agentId) == caller
            || identityRegistry.isApprovedForAll(owner, caller);
    }
}
