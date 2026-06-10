// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nexora4337AgentWallet} from "../src/Nexora4337AgentWallet.sol";
import {Nexora4337WalletFactory} from "../src/Nexora4337WalletFactory.sol";
import {NexoraAgentIdentityRegistry} from "../src/NexoraAgentIdentityRegistry.sol";
import {NexoraAgentReputationRegistry} from "../src/NexoraAgentReputationRegistry.sol";
import {NexoraAgentValidationRegistry} from "../src/NexoraAgentValidationRegistry.sol";
import {NexoraSafeVault} from "../src/NexoraSafeVault.sol";

contract GoodERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract BadERC721Receiver {}

contract MockEntryPoint {
    mapping(address => uint256) public balanceOf;

    function depositTo(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        require(balanceOf[msg.sender] >= withdrawAmount, "INSUFFICIENT_DEPOSIT");
        balanceOf[msg.sender] -= withdrawAmount;
        withdrawAddress.transfer(withdrawAmount);
    }

    receive() external payable {}
}

interface CheatcodeVm {
    function addr(uint256 privateKey) external returns (address);
    function deal(address who, uint256 newBalance) external;
    function prank(address) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256) external;
}

contract NexoraAgentWalletAutonomyTest {
    CheatcodeVm private constant vm = CheatcodeVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    NexoraAgentIdentityRegistry private identity;
    NexoraAgentValidationRegistry private validation;
    NexoraAgentReputationRegistry private reputation;
    Nexora4337WalletFactory private factory;
    NexoraSafeVault private safeVault;
    MockEntryPoint private mockEntryPoint;

    address private entryPoint;
    uint256 private ownerKey = 0xA11CE;
    uint256 private executorKey = 0xB0B;
    address private owner;
    address private executor;

    function setUp() public {
        owner = vm.addr(ownerKey);
        executor = vm.addr(executorKey);
        vm.deal(owner, 10 ether);
        identity = new NexoraAgentIdentityRegistry();
        validation = new NexoraAgentValidationRegistry(address(identity));
        reputation = new NexoraAgentReputationRegistry(address(identity));
        mockEntryPoint = new MockEntryPoint();
        entryPoint = address(mockEntryPoint);
        safeVault = new NexoraSafeVault();
        factory = new Nexora4337WalletFactory(
            address(identity),
            entryPoint,
            address(validation),
            address(reputation),
            address(safeVault),
            address(0),
            address(0)
        );
        identity.setController(address(factory), true);
    }

    function testMintsAgentIdentityAndDeploysWallet() public {
        (uint256 agentId, address walletAddress) = _createWallet();

        assert(agentId == 1);
        assert(walletAddress != address(0));
        assert(identity.ownerOf(agentId) == owner);
        assert(identity.agentWalletOf(agentId) == walletAddress);
        assert(identity.getAgentWallet(agentId) == walletAddress);
        assert(factory.walletOfAgent(agentId) == walletAddress);
        assert(Nexora4337AgentWallet(payable(walletAddress)).validationRegistry() == address(validation));
        assert(Nexora4337AgentWallet(payable(walletAddress)).allowedTargets(address(safeVault)));
        assert(Nexora4337AgentWallet(payable(walletAddress)).allowedTargetSelectors(address(safeVault), 0xd0e30db0));
        assert(Nexora4337AgentWallet(payable(walletAddress)).allowedTargetSelectors(address(safeVault), 0x2e1a7d4d));
    }

    function testAgentIdentitySupportsMetadataAndWalletResetOnTransfer() public {
        (uint256 agentId,) = _createWallet();

        vm.prank(owner);
        identity.setMetadata(agentId, "modelHash", abi.encodePacked(keccak256("qwen")));
        assert(identity.getMetadata(agentId, "modelHash").length == 32);

        address nextOwner = address(0xCAFE);
        vm.prank(owner);
        identity.transferFrom(owner, nextOwner, agentId);

        assert(identity.ownerOf(agentId) == nextOwner);
        assert(identity.getAgentWallet(agentId) == address(0));
    }

    function testSafeTransferRequiresCompatibleReceiver() public {
        (uint256 goodAgentId,) = _createWalletWithSalt("receiver-good");
        GoodERC721Receiver goodReceiver = new GoodERC721Receiver();

        vm.prank(owner);
        identity.safeTransferFrom(owner, address(goodReceiver), goodAgentId);
        assert(identity.ownerOf(goodAgentId) == address(goodReceiver));

        (uint256 badAgentId,) = _createWalletWithSalt("receiver-bad");
        BadERC721Receiver badReceiver = new BadERC721Receiver();

        vm.prank(owner);
        try identity.safeTransferFrom(owner, address(badReceiver), badAgentId) {
            revert("expected unsafe receiver revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testValidationRequestResponseCompatibility() public {
        (uint256 agentId,) = _createWallet();
        bytes32 requestHash = keccak256("request");
        address validator = address(0xA11D7);

        vm.prank(owner);
        validation.validationRequest(validator, agentId, "ipfs://request", requestHash);

        vm.prank(validator);
        validation.validationResponse(requestHash, 88, "ipfs://response", keccak256("response"), "benchmark");

        (, uint256 returnedAgentId, uint8 response,, string memory tag,) = validation.getValidationStatus(requestHash);
        assert(returnedAgentId == agentId);
        assert(response == 88);
        assert(keccak256(bytes(tag)) == keccak256(bytes("benchmark")));
    }

    function testRejectsUnauthorizedValidationReporter() public {
        (uint256 agentId,) = _createWallet();

        vm.prank(address(0xBEEF));
        try validation.recordValidation(_validationInput(agentId, keccak256("unauthorized-report"))) {
            revert("expected unauthorized reporter revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testValidatesExecutorUserOperation() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-executor");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        bytes memory callData = abi.encodeWithSelector(
            wallet.executeWithPreflight.selector,
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

        assert(validationData > 0);
        assert(wallet.nonce() == 1);
    }

    function testValidatesOwnerUserOperationWithoutTimeBounds() public {
        (, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes memory callData = abi.encodeWithSelector(
            wallet.executeWithPreflight.selector,
            address(safeVault),
            0,
            abi.encodeWithSignature("deposit()"),
            keccak256("owner-userop"),
            0
        );
        Nexora4337AgentWallet.PackedUserOperation memory userOp =
            _userOp(walletAddress, 0, callData, _signature(ownerKey, keccak256("owner-userop")));

        vm.prank(entryPoint);
        uint256 validationData = wallet.validateUserOp(userOp, keccak256("owner-userop"), 0);

        assert(validationData == 0);
        assert(wallet.nonce() == 1);
    }

    function testErc1271SignatureValidation() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        _configureWallet(wallet, agentId);

        bytes32 hash = keccak256("erc1271-hash");
        assert(wallet.isValidSignature(hash, _signature(ownerKey, hash)) == 0x1626ba7e);
        assert(wallet.isValidSignature(hash, _signature(executorKey, hash)) == 0x1626ba7e);
        assert(wallet.isValidSignature(hash, _signature(0xBAD, hash)) == 0xffffffff);
    }

    function testRejectsMalleatedHighSSignature() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        _configureWallet(wallet, agentId);

        bytes32 hash = keccak256("erc1271-hash");
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);

        // Same key, same digest, but the (n - s, flipped v) encoding must be rejected.
        bytes32 highS =
            bytes32(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;
        bytes memory malleated = abi.encodePacked(r, highS, flippedV);

        try wallet.isValidSignature(hash, malleated) returns (bytes4) {
            assert(false);
        } catch {}
    }

    function testRejectsUnauthorizedExecutorUserOperation() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-executor");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        bytes memory callData = abi.encodeWithSelector(
            wallet.executeWithPreflight.selector,
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
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
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
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
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
            address(otherVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
        ) {
            revert("expected target revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsSelectorNotAllowed() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-selector");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        vm.prank(owner);
        wallet.setAllowedSelector(address(safeVault), bytes4(keccak256("deposit()")), false);

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
        ) {
            revert("expected selector revert");
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
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
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
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
        );

        assert(safeVault.balanceOf(walletAddress) == 0.01 ether);
        assert(wallet.spentByDay(block.timestamp / 1 days) == 0.01 ether);

        NexoraAgentReputationRegistry.Reputation memory stats = reputation.getReputation(agentId);
        assert(stats.safeExecutions == 1);
        assert(stats.benchmarkRuns == 1);
    }

    function testRejectsReplayedActionIntent() public {
        (uint256 agentId, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-replay");
        _configureWallet(wallet, agentId);
        _recordPassingValidation(agentId, intentHash);

        (bool funded,) = walletAddress.call{value: 1 ether}("");
        assert(funded);

        vm.prank(executor);
        wallet.executeWithPreflightByExecutor(
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
        );

        vm.prank(executor);
        try wallet.executeWithPreflightByExecutor(
            address(safeVault), 0.01 ether, abi.encodeWithSignature("deposit()"), intentHash, 6
        ) {
            revert("expected replay revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testEntryPointDepositHelpers() public {
        (, address walletAddress) = _createWallet();
        Nexora4337AgentWallet wallet = Nexora4337AgentWallet(payable(walletAddress));

        vm.prank(owner);
        wallet.addEntryPointDeposit{value: 0.1 ether}();

        assert(wallet.entryPointDeposit() == 0.1 ether);

        vm.prank(owner);
        wallet.withdrawEntryPointDepositTo(payable(owner), 0.04 ether);

        assert(wallet.entryPointDeposit() == 0.06 ether);
    }

    function testRecordsReputationSignal() public {
        reputation.recordSignal(1, true, false, 6, 92);
        NexoraAgentReputationRegistry.Reputation memory stats = reputation.getReputation(1);

        assert(stats.benchmarkRuns == 1);
        assert(stats.safeExecutions == 1);
        assert(stats.trustScore > 0);
    }

    function testReputationFeedbackCompatibility() public {
        (uint256 agentId,) = _createWallet();
        address reviewer = address(0xFEE1);
        address[] memory reviewers = new address[](1);
        reviewers[0] = reviewer;

        vm.prank(reviewer);
        reputation.giveFeedback(agentId, 87, 0, "benchmark", "safe", "", "ipfs://feedback", keccak256("feedback"));

        (uint64 count, int128 summary,) = reputation.getSummary(agentId, reviewers, "benchmark", "safe");
        assert(count == 1);
        assert(summary == 87);
    }

    receive() external payable {}

    function _createWallet() private returns (uint256 agentId, address walletAddress) {
        return _createWalletWithSalt("wallet-salt");
    }

    function _createWalletWithSalt(string memory saltLabel) private returns (uint256 agentId, address walletAddress) {
        vm.prank(owner);
        (agentId, walletAddress) =
            factory.createAgentWallet("data:application/json,%7B%7D", keccak256(bytes(saltLabel)));
    }

    function _configureWallet(Nexora4337AgentWallet wallet, uint256 agentId) private {
        assert(agentId > 0);
        vm.prank(owner);
        wallet.setAllowedTarget(address(safeVault), true);
        vm.prank(owner);
        wallet.setAllowedSelector(address(safeVault), bytes4(keccak256("deposit()")), true);
        vm.prank(owner);
        wallet.setExecutorPolicy(executor, true, true, 0.02 ether, 0.05 ether, uint64(block.timestamp + 1 days));
    }

    function _recordPassingValidation(uint256 agentId, bytes32 intentHash) private {
        vm.prank(owner);
        validation.setReporter(agentId, address(this), true);
        validation.recordValidation(_validationInput(agentId, intentHash));
    }

    function _validationInput(uint256 agentId, bytes32 intentHash)
        private
        pure
        returns (NexoraAgentValidationRegistry.ValidationInput memory)
    {
        return NexoraAgentValidationRegistry.ValidationInput({
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
        });
    }

    function _userOp(address sender, uint256 opNonce, bytes memory callData, bytes memory signature)
        private
        pure
        returns (Nexora4337AgentWallet.PackedUserOperation memory)
    {
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

    function _signature(uint256 privateKey, bytes32 userOpHash) private returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
