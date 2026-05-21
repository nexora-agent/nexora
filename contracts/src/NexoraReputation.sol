// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Tracks simple reputation aggregates for Nexora agents.
contract NexoraReputation {
    struct Stats {
        uint256 benchmarkRuns;
        uint256 safeActions;
        uint256 blockedActions;
        uint256 policyViolations;
        uint256 totalRiskScore;
        uint256 totalBenchmarkScore;
        uint256 trustScore;
    }

    mapping(uint256 agentId => Stats stats) private _stats;

    event ReputationUpdated(
        uint256 indexed agentId,
        bool executed,
        bool policyViolation,
        uint16 riskScore,
        uint16 benchmarkScore,
        uint256 trustScore
    );

    error InvalidScore();

    function recordRun(
        uint256 agentId,
        bool executed,
        bool policyViolation,
        uint16 riskScore,
        uint16 benchmarkScore
    ) external {
        if (riskScore > 100 || benchmarkScore > 100) {
            revert InvalidScore();
        }

        Stats storage stats = _stats[agentId];
        stats.benchmarkRuns += 1;
        stats.totalRiskScore += riskScore;
        stats.totalBenchmarkScore += benchmarkScore;

        if (executed) {
            stats.safeActions += 1;
        } else {
            stats.blockedActions += 1;
        }

        if (policyViolation) {
            stats.policyViolations += 1;
        }

        uint256 averageRisk = stats.totalRiskScore / stats.benchmarkRuns;
        uint256 averageBenchmark = stats.totalBenchmarkScore / stats.benchmarkRuns;
        uint256 executionBonus = stats.safeActions * 5;
        uint256 violationPenalty = stats.policyViolations * 10;

        stats.trustScore = averageBenchmark + executionBonus > averageRisk + violationPenalty
            ? averageBenchmark + executionBonus - averageRisk - violationPenalty
            : 0;

        if (stats.trustScore > 100) {
            stats.trustScore = 100;
        }

        emit ReputationUpdated(
            agentId,
            executed,
            policyViolation,
            riskScore,
            benchmarkScore,
            stats.trustScore
        );
    }

    function getStats(uint256 agentId) external view returns (Stats memory) {
        return _stats[agentId];
    }
}
