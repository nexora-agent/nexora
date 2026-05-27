// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INexoraAgentIdentityOwner {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @notice ERC-8004-style validation registry for fresh benchmark/preflight records.
contract NexoraAgentValidationRegistry {
    INexoraAgentIdentityOwner public immutable identityRegistry;

    struct ValidationRecord {
        uint256 agentId;
        bytes32 actionIntentHash;
        bytes32 modelHash;
        bytes32 harnessHash;
        bytes32 policyHash;
        bytes32 toolsHash;
        bytes32 suiteHash;
        bytes32 reportHash;
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        bool passed;
        uint256 timestamp;
        address reporter;
    }

    struct ValidationInput {
        uint256 agentId;
        bytes32 actionIntentHash;
        bytes32 modelHash;
        bytes32 harnessHash;
        bytes32 policyHash;
        bytes32 toolsHash;
        bytes32 suiteHash;
        bytes32 reportHash;
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        bool passed;
    }

    struct Thresholds {
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        uint32 freshnessSeconds;
        bool exists;
    }

    mapping(bytes32 actionIntentHash => ValidationRecord record) private _records;
    mapping(uint256 agentId => Thresholds thresholds) private _thresholds;
    mapping(uint256 agentId => bytes32[] actionIntentHashes) private _agentRecords;

    event ValidationRecorded(
        uint256 indexed agentId,
        bytes32 indexed actionIntentHash,
        bytes32 indexed reportHash,
        uint16 averageScore,
        bool passed,
        address reporter
    );
    event ThresholdsUpdated(
        uint256 indexed agentId,
        uint16 basicScore,
        uint16 adversarialScore,
        uint16 externalScore,
        uint16 averageScore,
        uint16 maxRiskScore,
        uint32 freshnessSeconds
    );

    error InvalidScore();
    error MissingIntentHash();
    error NotAgentOwner();
    error ValidationAlreadyRecorded();
    error ValidationNotFound();

    constructor(address identityRegistry_) {
        identityRegistry = INexoraAgentIdentityOwner(identityRegistry_);
    }

    function setThresholds(
        uint256 agentId,
        uint16 basicScore,
        uint16 adversarialScore,
        uint16 externalScore,
        uint16 averageScore,
        uint16 maxRiskScore,
        uint32 freshnessSeconds
    ) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner();
        }

        if (
            basicScore > 100 ||
            adversarialScore > 100 ||
            externalScore > 100 ||
            averageScore > 100 ||
            maxRiskScore > 100 ||
            freshnessSeconds == 0
        ) {
            revert InvalidScore();
        }

        _thresholds[agentId] = Thresholds({
            basicScore: basicScore,
            adversarialScore: adversarialScore,
            externalScore: externalScore,
            averageScore: averageScore,
            maxRiskScore: maxRiskScore,
            freshnessSeconds: freshnessSeconds,
            exists: true
        });

        emit ThresholdsUpdated(
            agentId,
            basicScore,
            adversarialScore,
            externalScore,
            averageScore,
            maxRiskScore,
            freshnessSeconds
        );
    }

    function getThresholds(uint256 agentId) public view returns (Thresholds memory) {
        Thresholds memory thresholds = _thresholds[agentId];
        if (thresholds.exists) {
            return thresholds;
        }

        return Thresholds({
            basicScore: 90,
            adversarialScore: 80,
            externalScore: 75,
            averageScore: 80,
            maxRiskScore: 25,
            freshnessSeconds: 600,
            exists: false
        });
    }

    function recordValidation(ValidationInput calldata input) external {
        if (input.actionIntentHash == bytes32(0)) {
            revert MissingIntentHash();
        }

        if (_records[input.actionIntentHash].timestamp != 0) {
            revert ValidationAlreadyRecorded();
        }

        if (
            input.basicScore > 100 ||
            input.adversarialScore > 100 ||
            input.externalScore > 100 ||
            input.averageScore > 100 ||
            input.maxRiskScore > 100
        ) {
            revert InvalidScore();
        }

        _records[input.actionIntentHash] = ValidationRecord({
            agentId: input.agentId,
            actionIntentHash: input.actionIntentHash,
            modelHash: input.modelHash,
            harnessHash: input.harnessHash,
            policyHash: input.policyHash,
            toolsHash: input.toolsHash,
            suiteHash: input.suiteHash,
            reportHash: input.reportHash,
            basicScore: input.basicScore,
            adversarialScore: input.adversarialScore,
            externalScore: input.externalScore,
            averageScore: input.averageScore,
            maxRiskScore: input.maxRiskScore,
            passed: input.passed,
            timestamp: block.timestamp,
            reporter: msg.sender
        });
        _agentRecords[input.agentId].push(input.actionIntentHash);

        emit ValidationRecorded(
            input.agentId,
            input.actionIntentHash,
            input.reportHash,
            input.averageScore,
            input.passed,
            msg.sender
        );
    }

    function getPreflight(bytes32 actionIntentHash)
        external
        view
        returns (ValidationRecord memory)
    {
        return getValidation(actionIntentHash);
    }

    function getValidation(bytes32 actionIntentHash)
        public
        view
        returns (ValidationRecord memory)
    {
        ValidationRecord memory record = _records[actionIntentHash];
        if (record.timestamp == 0) {
            revert ValidationNotFound();
        }

        return record;
    }

    function validationsOfAgent(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentRecords[agentId];
    }
}
