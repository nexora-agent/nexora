// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraReputation} from "../src/NexoraReputation.sol";

contract NexoraReputationTest {
    NexoraReputation private reputation;

    function setUp() public {
        reputation = new NexoraReputation();
    }

    function testRecordsSafeAndBlockedRuns() public {
        reputation.recordRun(1, true, false, 28, 90);
        reputation.recordRun(1, false, true, 85, 35);

        NexoraReputation.Stats memory stats = reputation.getStats(1);

        assert(stats.benchmarkRuns == 2);
        assert(stats.safeActions == 1);
        assert(stats.blockedActions == 1);
        assert(stats.policyViolations == 1);
        assert(stats.trustScore <= 100);
    }

    function testRejectsInvalidScores() public {
        try reputation.recordRun(1, true, false, 101, 90) {
            revert("expected invalid score revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}
