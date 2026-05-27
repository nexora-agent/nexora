// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nexora4337AgentWallet} from "../src/Nexora4337AgentWallet.sol";
import {Nexora4337WalletFactory} from "../src/Nexora4337WalletFactory.sol";
import {NexoraAgentIdentityRegistry} from "../src/NexoraAgentIdentityRegistry.sol";
import {NexoraAgentReputationRegistry} from "../src/NexoraAgentReputationRegistry.sol";
import {NexoraAgentValidationRegistry} from "../src/NexoraAgentValidationRegistry.sol";
import {NexoraSafeVault} from "../src/NexoraSafeVault.sol";

interface V2Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256) external;
}

contract NexoraV2AgentWalletTest {
    V2Vm private constant vm = V2Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    NexoraAgentIdentityRegistry private identity;
    NexoraAgentValidationRegistry private validation;
    NexoraAgentReputationRegistry private reputation;
    Nexora4337WalletFactory private factory;
    NexoraSafeVault private safeVault;

    address private entryPoint = address(0x4337);
    uint256 private ownerKey = 0xA11CE;
    uint256 private executorKey = 0xB0B;
    address private owner;
    address private executor;

    function setUp() public {
        owner = vm.addr(ownerKey);
        executor = vm.addr(executorKey);
        identity = new NexoraAgentIdentityRegistry();
        validation = new NexoraAgentValidationRegistry(address(identity));
        reputation = new NexoraAgentReputationRegistry();
        factory = new Nexora4337WalletFactory(address(identity), entryPoint);
        safeVault = new NexoraSafeVault();
        identity.setController(address(factory), true);
    }

    function testMintsAgentIdentityAndDeploysWallet() public {
        (uint256 agentId, address walletAddress) = _createWallet();

        assert(agentId == 1);
        assert(walletAddress != address(0));
        assert(identity.ownerOf(agentId) == owner);
        assert(identity.agentWalletOf(agentId) == walletAddress);
        assert(factory.walletOfAgent(agentId) == walletAddress);
    }

    function testValidatesExecutorUserOperation() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-executor");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        bytes memory callData = abi.encodeWithSelector(
            wallet.executeWithPreflight.selector,
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        );
        Nexora4337AgentWallet.PackedUserOperation memory userOp =
            _userOp(walletAddress, 0, callData, _signature(executorKey, keccak256("userop-1")));

        vm.prank(entryPoint);
        uint256 validationData = wallet.validateUserOp(userOp, keccak256("userop-1"), 0);

        assert(validationData == 0);
        assert(wallet.nonce() == 1);
    }

    function testRejectsUnauthorizedExecutorUserOperation() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-executor");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        bytes memory callData = abi.encodeWithSelector(
            wallet.executeWithPreflight.selector,
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        );
        Nexora4337AgentWallet.PackedUserOperation memory userOp =
            _userOp(walletAddress, 0, callData, _signature(0xBAD, keccak256("userop-2")));

        vm.prank(entryPoint);
        uint256 validationData = wallet.validateUserOp(userOp, keccak256("userop-2"), 0);

        assert(validationData == 1);
        assert(wallet.nonce() == 0);
    }

    function testRejectsMissingPreflightForExecutor() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        _configureWallet(wallet, agentId);

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            keccak256("missing"),
            6
        ) {
            revert("expected missing validation revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsStalePreflightForExecutor() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-stale");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        vm.prank(owner);
        validation.setThresholds(agentId, 90, 80, 75, 80, 25, 1);
        vm.warp(block.timestamp + 2);

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        ) {
            revert("expected stale validation revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsScoreBelowThreshold() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-low-score");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        vm.prank(owner);
        validation.setThresholds(agentId, 99, 99, 99, 99, 25, 600);

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        ) {
            revert("expected score validation revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsTargetNotAllowed() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        NexoraSafeVault otherVault = new NexoraSafeVault();
        bytes32 intentHash = keccak256("intent-target");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(validation),
            address(otherVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        ) {
            revert("expected target revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testEnforcesPerActionAndDailyLimits() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-spend-limit");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        vm.prank(owner);
        wallet.setExecutorPolicy(executor, true, true, 0.005 ether, 0.02 ether, uint64(block.timestamp + 1 days));

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        ) {
            revert("expected spend limit revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testExecutesMantleVaultDepositAfterPassingPreflight() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-deposit");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        (bool funded,) = walletAddress.call{value: 1 ether}("");
        assert(funded);

        vm.prank(executor);
        wallet.executeWithPreflightByExecutor(
            address(validation),
            address(safeVault),
            0.01 ether,
            abi.encodeWithSignature("deposit()"),
            intentHash,
            6
        );

        assert(safeVault.balanceOf(walletAddress) == 0.01 ether);
        assert(wallet.spentByDay(block.timestamp / 1 days) == 0.01 ether);
    }

    function testRecordsReputationSignal() public {
        reputation.recordSignal(1, true, false, 6, 92);
        NexoraAgentReputationRegistry.Reputation memory stats = reputation.getReputation(1);

        assert(stats.benchmarkRuns == 1);
        assert(stats.safeExecutions == 1);
        assert(stats.trustScore > 0);
    }

    receive() external payable {}

    function _createWallet() private returns (uint256 agentId, address walletAddress) {
        vm.prank(owner);
        (agentId, walletAddress) = factory.createAgentWallet(
            "data:application/json,%7B%7D",
            keccak256("wallet-salt")
        );
    }

    function _configureWallet(Nexora4337AgentWallet wallet, uint256 agentId) private {
        assert(agentId > 0);
        vm.prank(owner);
        wallet.setAllowedTarget(address(safeVault), true);
        vm.prank(owner);
        wallet.setExecutorPolicy(
            executor,
            true,
            true,
            0.02 ether,
            0.05 ether,
            uint64(block.timestamp + 1 days)
        );
    }

    function _recordPassingValidation(uint256 agentId, bytes32 intentHash) private {
        validation.recordValidation(
            NexoraAgentValidationRegistry.ValidationInput({
                agentId: agentId,
                actionIntentHash: intentHash,
                modelHash: keccak256("model"),
                harnessHash: keccak256("harness"),
                policyHash: keccak256("policy"),
                toolsHash: keccak256("tools"),
                suiteHash: keccak256("suite"),
                reportHash: keccak256("report"),
                basicScore: 92,
                adversarialScore: 86,
                externalScore: 80,
                averageScore: 86,
                maxRiskScore: 25,
                passed: true
            })
        );
    }

    function _userOp(
        address sender,
        uint256 opNonce,
        bytes memory callData,
        bytes memory signature
    ) private pure returns (Nexora4337AgentWallet.PackedUserOperation memory) {
        return Nexora4337AgentWallet.PackedUserOperation({
            sender: sender,
            nonce: opNonce,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: signature
        });
    }

    function _signature(uint256 privateKey, bytes32 userOpHash)
        private
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
