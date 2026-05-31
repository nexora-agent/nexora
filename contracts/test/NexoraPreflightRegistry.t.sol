// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentWallet} from "../src/NexoraAgentWallet.sol";
import {NexoraPreflightRegistry} from "../src/NexoraPreflightRegistry.sol";
import {NexoraSafeVault} from "../src/NexoraSafeVault.sol";
import {NexoraSmartWalletRegistry} from "../src/NexoraSmartWalletRegistry.sol";

interface Vm {
    function warp(uint256) external;
}

contract NexoraPreflightRegistryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    NexoraSmartWalletRegistry private smartWalletRegistry;
    NexoraPreflightRegistry private registry;

    function setUp() public {
        smartWalletRegistry = new NexoraSmartWalletRegistry();
        registry = new NexoraPreflightRegistry(address(smartWalletRegistry));
    }

    function testRecordsPassingPreflight() public {
        bytes32 intentHash = keccak256("intent-1");

        _recordPassingPreflight(1, intentHash);

        NexoraPreflightRegistry.PreflightRecord memory record = registry.getPreflight(intentHash);

        assert(record.walletId == 1);
        assert(record.actionIntentHash == intentHash);
        assert(record.basicScore == 92);
        assert(record.adversarialScore == 86);
        assert(record.externalScore == 80);
        assert(record.averageScore == 86);
        assert(record.maxRiskScore == 25);
        assert(record.passed);
        assert(record.timestamp > 0);
        assert(record.reporter == address(this));
    }

    function testRejectsDuplicatePreflightHash() public {
        bytes32 intentHash = keccak256("intent-1");
        _recordPassingPreflight(1, intentHash);

        try this.recordDuplicate(intentHash) {
            revert("expected duplicate revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsExecutionWithMissingPreflight() public {
        (, address walletAddress) = _createWallet();
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));

        try wallet.executeWithPreflight(address(registry), address(this), 0, "", keccak256("missing-intent"), 6) {
            revert("expected missing preflight revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsExecutionWithMismatchedWalletId() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-1");
        _recordPassingPreflight(agentId + 1, intentHash);

        try wallet.executeWithPreflight(address(registry), address(this), 0, "", intentHash, 6) {
            revert("expected wallet mismatch revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsStalePreflight() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-1");
        _recordPassingPreflight(agentId, intentHash);
        registry.setPreflightThresholds(agentId, 90, 80, 75, 80, 25, 1);
        vm.warp(block.timestamp + 2);

        try wallet.executeWithPreflight(address(registry), address(this), 0, "", intentHash, 6) {
            revert("expected stale revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsScoreBelowThreshold() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-1");
        _recordPassingPreflight(agentId, intentHash);
        registry.setPreflightThresholds(agentId, 99, 99, 99, 99, 25, 600);

        try wallet.executeWithPreflight(address(registry), address(this), 0, "", intentHash, 6) {
            revert("expected score revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testExecutesMantleVaultDepositAfterPassingPreflight() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));
        NexoraSafeVault vault = new NexoraSafeVault();
        bytes32 intentHash = keccak256("intent-1");
        _recordPassingPreflight(agentId, intentHash);

        (bool funded,) = walletAddress.call{value: 1 ether}("");
        assert(funded);

        wallet.executeWithPreflight(
            address(registry), address(vault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
        );

        assert(vault.balanceOf(walletAddress) == 0.01 ether);
    }

    function recordDuplicate(bytes32 intentHash) external {
        _recordPassingPreflight(1, intentHash);
    }

    receive() external payable {}

    function _createWallet() private returns (uint256 smartWalletId, address walletAddress) {
        smartWalletId = smartWalletRegistry.registerSmartWallet("ipfs://wallet-1", keccak256("safe-approval"), 0, 0);
        walletAddress = smartWalletRegistry.createSmartWallet(smartWalletId);
    }

    function _recordPassingPreflight(uint256 walletId, bytes32 intentHash) private {
        registry.recordPreflight(
            NexoraPreflightRegistry.PreflightInput({
                walletId: walletId,
                actionIntentHash: intentHash,
                modelHash: keccak256("model"),
                harnessHash: keccak256("harness"),
                policyHash: keccak256("policy"),
                toolsHash: keccak256("tools"),
                suiteHash: keccak256("suite"),
                basicScore: 92,
                adversarialScore: 86,
                externalScore: 80,
                averageScore: 86,
                maxRiskScore: 25,
                passed: true
            })
        );
    }
}
