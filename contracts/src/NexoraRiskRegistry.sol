// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Stores risk and benchmark report commitments for Nexora agent runs.
contract NexoraRiskRegistry {
    struct Report {
        uint256 agentId;
        bytes32 harnessId;
        bytes32 objectiveRunId;
        bytes32 intentHash;
        uint16 riskScore;
        bool policyPassed;
        uint16 benchmarkScore;
        bytes32 reportHash;
        uint256 timestamp;
        address reporter;
    }

    mapping(bytes32 reportHash => Report report) private _reports;

    event ReportRecorded(
        bytes32 indexed reportHash,
        uint256 indexed agentId,
        bytes32 indexed objectiveRunId,
        bytes32 intentHash,
        uint16 riskScore,
        bool policyPassed,
        uint16 benchmarkScore,
        address reporter
    );

    error InvalidScore();
    error ReportAlreadyRecorded();
    error ReportNotFound();

    function recordReport(
        uint256 agentId,
        bytes32 harnessId,
        bytes32 objectiveRunId,
        bytes32 intentHash,
        uint16 riskScore,
        bool policyPassed,
        uint16 benchmarkScore,
        bytes32 reportHash
    ) external {
        if (riskScore > 100 || benchmarkScore > 100) {
            revert InvalidScore();
        }

        if (_reports[reportHash].timestamp != 0) {
            revert ReportAlreadyRecorded();
        }

        _reports[reportHash] = Report({
            agentId: agentId,
            harnessId: harnessId,
            objectiveRunId: objectiveRunId,
            intentHash: intentHash,
            riskScore: riskScore,
            policyPassed: policyPassed,
            benchmarkScore: benchmarkScore,
            reportHash: reportHash,
            timestamp: block.timestamp,
            reporter: msg.sender
        });

        emit ReportRecorded(
            reportHash,
            agentId,
            objectiveRunId,
            intentHash,
            riskScore,
            policyPassed,
            benchmarkScore,
            msg.sender
        );
    }

    function getReport(bytes32 reportHash) external view returns (Report memory report) {
        report = _reports[reportHash];
        if (report.timestamp == 0) {
            revert ReportNotFound();
        }
    }
}
