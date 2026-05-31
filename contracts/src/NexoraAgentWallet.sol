// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraPreflightRegistry} from "./NexoraPreflightRegistry.sol";

/// @notice Minimal smart wallet owned by a user and linked to a Nexora agent.
contract NexoraAgentWallet {
    address public immutable owner;
    uint256 public immutable agentId;

    event Executed(address indexed target, uint256 value, bytes data, bytes result);
    event PolicyBlocked(bytes32 indexed intentHash, bytes32 indexed reportHash, string reason);

    error NotOwner();
    error ExecutionFailed();
    error MissingReport();
    error IntentMismatch();
    error PolicyBlockedExecution();
    error PreflightFailed();
    error PreflightScoreTooLow();
    error PreflightStale();
    error PreflightWalletMismatch();
    error RiskTooHigh();

    struct ExecutionReport {
        bytes32 intentHash;
        uint16 riskScore;
        bool policyPassed;
        bytes32 reportHash;
    }

    struct PreflightThresholds {
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        uint256 freshnessSeconds;
    }

    constructor(address initialOwner, uint256 linkedAgentId) {
        owner = initialOwner;
        agentId = linkedAgentId;
    }

    receive() external payable {}

    function execute(address target, uint256 value, bytes calldata data)
        external
        payable
        returns (bytes memory result)
    {
        if (msg.sender != owner) {
            revert NotOwner();
        }

        bool success;
        (success, result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed();
        }

        emit Executed(target, value, data, result);
    }

    function executeWithRiskReport(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 intentHash,
        uint16 maxRiskScore,
        ExecutionReport calldata report
    ) external payable returns (bytes memory result) {
        if (msg.sender != owner) {
            revert NotOwner();
        }

        if (report.reportHash == bytes32(0)) {
            revert MissingReport();
        }

        if (report.intentHash != intentHash) {
            emit PolicyBlocked(intentHash, report.reportHash, "intent mismatch");
            revert IntentMismatch();
        }

        if (!report.policyPassed) {
            emit PolicyBlocked(intentHash, report.reportHash, "policy blocked");
            revert PolicyBlockedExecution();
        }

        if (report.riskScore > maxRiskScore) {
            emit PolicyBlocked(intentHash, report.reportHash, "risk too high");
            revert RiskTooHigh();
        }

        bool success;
        (success, result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed();
        }

        emit Executed(target, value, data, result);
    }

    function executeWithPreflight(
        address preflightRegistry,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 actionIntentHash,
        uint16 riskScore
    ) external payable returns (bytes memory result) {
        if (msg.sender != owner) {
            revert NotOwner();
        }

        _validatePreflight(preflightRegistry, actionIntentHash, riskScore);

        bool success;
        (success, result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed();
        }

        emit Executed(target, value, data, result);
    }

    function _validatePreflight(address preflightRegistry, bytes32 actionIntentHash, uint16 riskScore) private view {
        NexoraPreflightRegistry registry = NexoraPreflightRegistry(preflightRegistry);
        NexoraPreflightRegistry.PreflightRecord memory preflight = registry.getPreflight(actionIntentHash);
        NexoraPreflightRegistry.PreflightThresholds memory thresholds = registry.getPreflightThresholds(agentId);

        if (preflight.actionIntentHash != actionIntentHash) {
            revert IntentMismatch();
        }

        if (preflight.walletId != agentId) {
            revert PreflightWalletMismatch();
        }

        if (!preflight.passed) {
            revert PreflightFailed();
        }

        if (block.timestamp >= preflight.timestamp + thresholds.freshnessSeconds) {
            revert PreflightStale();
        }

        if (
            preflight.basicScore < thresholds.basicScore || preflight.adversarialScore < thresholds.adversarialScore
                || preflight.externalScore < thresholds.externalScore || preflight.averageScore < thresholds.averageScore
        ) {
            revert PreflightScoreTooLow();
        }

        if (riskScore > thresholds.maxRiskScore || preflight.maxRiskScore > thresholds.maxRiskScore) {
            revert RiskTooHigh();
        }
    }
}
