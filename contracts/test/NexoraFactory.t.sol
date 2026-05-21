// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentIdentity} from "../src/NexoraAgentIdentity.sol";
import {NexoraAgentWallet} from "../src/NexoraAgentWallet.sol";
import {NexoraFactory} from "../src/NexoraFactory.sol";

contract NexoraFactoryTest {
    NexoraAgentIdentity private identity;
    NexoraFactory private factory;

    function setUp() public {
        identity = new NexoraAgentIdentity();
        factory = new NexoraFactory(identity);
    }

    function testCreatesWalletForAgentOwner() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");

        address walletAddress = factory.createAgentWallet(agentId);
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));

        assert(wallet.owner() == address(this));
        assert(wallet.agentId() == agentId);
        assert(factory.walletOfAgent(agentId) == walletAddress);
        assert(factory.agentOfWallet(walletAddress) == agentId);
    }

    function testDuplicateCreateReturnsExistingWallet() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");

        address firstWallet = factory.createAgentWallet(agentId);
        address secondWallet = factory.createAgentWallet(agentId);

        assert(firstWallet == secondWallet);
    }

    function testRejectsNonOwnerWalletCreation() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");
        WalletAttacker attacker = new WalletAttacker(factory);

        try attacker.create(agentId) {
            revert("expected owner revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testOnlyOwnerCanExecute() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");
        address walletAddress = factory.createAgentWallet(agentId);
        WalletAttacker attacker = new WalletAttacker(factory);

        try attacker.execute(walletAddress) {
            revert("expected wallet owner revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testPolicyGatedExecutionRequiresMatchingPassingReport() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");
        address walletAddress = factory.createAgentWallet(agentId);
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-1");

        NexoraAgentWallet.ExecutionReport memory report = NexoraAgentWallet.ExecutionReport({
            intentHash: intentHash,
            riskScore: 28,
            policyPassed: true,
            reportHash: keccak256("report-1")
        });
        ExecutionTarget target = new ExecutionTarget();

        wallet.executeWithRiskReport(address(target), 0, "", intentHash, 60, report);
    }

    function testPolicyGatedExecutionBlocksRiskyReport() public {
        uint256 agentId = identity.registerAgent("ipfs://agent-1");
        address walletAddress = factory.createAgentWallet(agentId);
        NexoraAgentWallet wallet = NexoraAgentWallet(payable(walletAddress));
        bytes32 intentHash = keccak256("intent-1");

        NexoraAgentWallet.ExecutionReport memory report = NexoraAgentWallet.ExecutionReport({
            intentHash: intentHash,
            riskScore: 85,
            policyPassed: true,
            reportHash: keccak256("report-1")
        });

        try wallet.executeWithRiskReport(address(this), 0, "", intentHash, 60, report) {
            revert("expected risk revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}

contract ExecutionTarget {
    receive() external payable {}

    fallback() external payable {}
}

contract WalletAttacker {
    NexoraFactory private immutable factory;

    constructor(NexoraFactory factory_) {
        factory = factory_;
    }

    function create(uint256 agentId) external returns (address) {
        return factory.createAgentWallet(agentId);
    }

    function execute(address walletAddress) external {
        NexoraAgentWallet(payable(walletAddress)).execute(address(this), 0, "");
    }
}
