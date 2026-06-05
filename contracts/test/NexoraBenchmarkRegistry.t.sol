// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentityRegistry} from "../src/NexoraAgentIdentityRegistry.sol";
import {NexoraBenchmarkRegistry} from "../src/NexoraBenchmarkRegistry.sol";

interface BenchmarkVm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address) external;
}

contract NexoraBenchmarkRegistryTest {
    BenchmarkVm private constant vm = BenchmarkVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    NexoraAgentIdentityRegistry private identity;
    NexoraBenchmarkRegistry private registry;
    address private owner;
    address private other;

    function setUp() public {
        owner = vm.addr(0xA11CE);
        other = vm.addr(0xB0B);
        identity = new NexoraAgentIdentityRegistry();
        registry = new NexoraBenchmarkRegistry(address(identity));
    }

    function testRegistersBenchmarkAndSelectsForAgent() public {
        vm.prank(owner);
        uint256 agentId = identity.registerAgent("data:agent");

        address[] memory targets = new address[](1);
        targets[0] = address(0xCAFE);

        vm.prank(owner);
        uint256 benchmarkId = registry.registerBenchmark(
            "Test Benchmark",
            "Stores full benchmark JSON on-chain.",
            "dex-trading",
            '{"name":"Test Benchmark"}',
            targets,
            0,
            keccak256("benchmark")
        );

        vm.prank(owner);
        registry.selectBenchmarkForAgent(agentId, benchmarkId);

        NexoraBenchmarkRegistry.Benchmark memory benchmark = registry.getActiveBenchmark(agentId);
        assert(benchmark.benchmarkId == benchmarkId);
        assert(benchmark.owner == owner);
        assert(benchmark.benchmarkHash == keccak256("benchmark"));
        assert(keccak256(bytes(benchmark.name)) == keccak256(bytes("Test Benchmark")));
        assert(keccak256(bytes(benchmark.benchmarkType)) == keccak256(bytes("dex-trading")));
        assert(keccak256(bytes(benchmark.benchmarkDataJson)) == keccak256(bytes('{"name":"Test Benchmark"}')));
        assert(benchmark.targetContracts.length == 1);
        assert(benchmark.targetContracts[0] == address(0xCAFE));
    }

    function testRejectsNonOwnerSelection() public {
        vm.prank(owner);
        uint256 agentId = identity.registerAgent("data:agent");

        address[] memory targets = new address[](0);
        vm.prank(owner);
        uint256 benchmarkId = registry.registerBenchmark(
            "Test Benchmark",
            "Stores full benchmark JSON on-chain.",
            "custom",
            '{"name":"Test Benchmark"}',
            targets,
            0,
            keccak256("benchmark")
        );

        vm.prank(other);
        try registry.selectBenchmarkForAgent(agentId, benchmarkId) {
            revert("expected not owner revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsInactiveBenchmarkSelection() public {
        vm.prank(owner);
        uint256 agentId = identity.registerAgent("data:agent");

        address[] memory targets = new address[](0);
        vm.prank(owner);
        uint256 benchmarkId = registry.registerBenchmark(
            "Test Benchmark",
            "Stores full benchmark JSON on-chain.",
            "custom",
            '{"name":"Test Benchmark"}',
            targets,
            0,
            keccak256("benchmark")
        );

        vm.prank(owner);
        registry.setBenchmarkActive(benchmarkId, false);

        vm.prank(owner);
        try registry.selectBenchmarkForAgent(agentId, benchmarkId) {
            revert("expected inactive revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}
