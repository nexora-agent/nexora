// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraRiskRegistry} from "../src/NexoraRiskRegistry.sol";

contract NexoraRiskRegistryTest {
    NexoraRiskRegistry private registry;

    function setUp() public {
        registry = new NexoraRiskRegistry();
    }

    function testRecordsReport() public {
        bytes32 reportHash = keccak256("report-1");

        registry.recordReport(
            1, keccak256("safe-approval"), keccak256("objective-1"), keccak256("intent-1"), 28, true, 92, reportHash
        );

        NexoraRiskRegistry.Report memory report = registry.getReport(reportHash);

        assert(report.agentId == 1);
        assert(report.riskScore == 28);
        assert(report.policyPassed);
        assert(report.benchmarkScore == 92);
        assert(report.reporter == address(this));
    }

    function testRejectsInvalidScore() public {
        try registry.recordReport(
            1,
            keccak256("safe-approval"),
            keccak256("objective-1"),
            keccak256("intent-1"),
            101,
            true,
            92,
            keccak256("report-1")
        ) {
            revert("expected invalid score revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsDuplicateReport() public {
        bytes32 reportHash = keccak256("report-1");

        registry.recordReport(
            1, keccak256("safe-approval"), keccak256("objective-1"), keccak256("intent-1"), 28, true, 92, reportHash
        );

        try registry.recordReport(
            1, keccak256("safe-approval"), keccak256("objective-1"), keccak256("intent-1"), 28, true, 92, reportHash
        ) {
            revert("expected duplicate report revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}
