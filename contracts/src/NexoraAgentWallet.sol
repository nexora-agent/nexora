// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
    error RiskTooHigh();

    struct ExecutionReport {
        bytes32 intentHash;
        uint16 riskScore;
        bool policyPassed;
        bytes32 reportHash;
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
}
