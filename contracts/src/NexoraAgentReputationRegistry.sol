// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-8004-style reputation aggregates for Nexora agent identities.
contract NexoraAgentReputationRegistry {
    struct Reputation {
        uint256 benchmarkRuns;
        uint256 safeExecutions;
        uint256 blockedExecutions;
        uint256 policyViolations;
        uint256 totalRiskScore;
        uint256 totalBenchmarkScore;
        uint256 trustScore;
    }

    mapping(uint256 agentId => Reputation reputation) private _reputation;

    event ReputationSignal(
        uint256 indexed agentId,
        bool executed,
        bool policyViolation,
        uint16 riskScore,
        uint16 benchmarkScore,
        uint256 trustScore,
        address indexed reporter
    );

    error InvalidScore();

    function recordSignal(
        uint256 agentId,
        bool executed,
        bool policyViolation,
        uint16 riskScore,
        uint16 benchmarkScore
    ) external {
        if (riskScore > 100 || benchmarkScore > 100) {
            revert InvalidScore();
        }

        Reputation storage reputation = _reputation[agentId];
        reputation.benchmarkRuns += 1;
        reputation.totalRiskScore += riskScore;
        reputation.totalBenchmarkScore += benchmarkScore;

        if (executed) {
            reputation.safeExecutions += 1;
        } else {
            reputation.blockedExecutions += 1;
        }

        if (policyViolation) {
            reputation.policyViolations += 1;
        }

        uint256 averageBenchmark = reputation.totalBenchmarkScore / reputation.benchmarkRuns;
        uint256 averageRisk = reputation.totalRiskScore / reputation.benchmarkRuns;
        uint256 executionBonus = reputation.safeExecutions * 4;
        uint256 violationPenalty = reputation.policyViolations * 12;

        reputation.trustScore = averageBenchmark + executionBonus > averageRisk + violationPenalty
            ? averageBenchmark + executionBonus - averageRisk - violationPenalty
            : 0;

        if (reputation.trustScore > 100) {
            reputation.trustScore = 100;
        }

        emit ReputationSignal(
            agentId,
            executed,
            policyViolation,
            riskScore,
            benchmarkScore,
            reputation.trustScore,
            msg.sender
        );
    }

    function getReputation(uint256 agentId) external view returns (Reputation memory) {
        return _reputation[agentId];
    }
}
