// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INexoraSmartWalletRegistry {
    function ownerOfSmartWallet(uint256 smartWalletId) external view returns (address);
}

/// @notice Stores fresh benchmark credentials for a proposed wallet action.
contract NexoraPreflightRegistry {
    INexoraSmartWalletRegistry public immutable smartWalletRegistry;

    struct PreflightRecord {
        uint256 walletId;
        bytes32 actionIntentHash;
        bytes32 modelHash;
        bytes32 harnessHash;
        bytes32 policyHash;
        bytes32 toolsHash;
        bytes32 suiteHash;
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        bool passed;
        uint256 timestamp;
        address reporter;
    }

    struct PreflightInput {
        uint256 walletId;
        bytes32 actionIntentHash;
        bytes32 modelHash;
        bytes32 harnessHash;
        bytes32 policyHash;
        bytes32 toolsHash;
        bytes32 suiteHash;
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        bool passed;
    }

    struct PreflightThresholds {
        uint16 basicScore;
        uint16 adversarialScore;
        uint16 externalScore;
        uint16 averageScore;
        uint16 maxRiskScore;
        uint32 freshnessSeconds;
        bool exists;
    }

    mapping(bytes32 actionIntentHash => PreflightRecord record) private _preflights;
    mapping(uint256 walletId => PreflightThresholds thresholds) private _thresholds;

    event PreflightRecorded(
        uint256 indexed walletId,
        bytes32 indexed actionIntentHash,
        bytes32 suiteHash,
        uint16 averageScore,
        bool passed,
        address indexed reporter
    );
    event PreflightThresholdsUpdated(
        uint256 indexed walletId,
        uint16 basicScore,
        uint16 adversarialScore,
        uint16 externalScore,
        uint16 averageScore,
        uint16 maxRiskScore,
        uint32 freshnessSeconds
    );

    error InvalidScore();
    error MissingIntentHash();
    error NotSmartWalletOwner();
    error PreflightAlreadyRecorded();
    error PreflightNotFound();

    constructor(address smartWalletRegistry_) {
        smartWalletRegistry = INexoraSmartWalletRegistry(smartWalletRegistry_);
    }

    function setPreflightThresholds(
        uint256 walletId,
        uint16 basicScore,
        uint16 adversarialScore,
        uint16 externalScore,
        uint16 averageScore,
        uint16 maxRiskScore,
        uint32 freshnessSeconds
    ) external {
        if (smartWalletRegistry.ownerOfSmartWallet(walletId) != msg.sender) {
            revert NotSmartWalletOwner();
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

        _thresholds[walletId] = PreflightThresholds({
            basicScore: basicScore,
            adversarialScore: adversarialScore,
            externalScore: externalScore,
            averageScore: averageScore,
            maxRiskScore: maxRiskScore,
            freshnessSeconds: freshnessSeconds,
            exists: true
        });

        emit PreflightThresholdsUpdated(
            walletId,
            basicScore,
            adversarialScore,
            externalScore,
            averageScore,
            maxRiskScore,
            freshnessSeconds
        );
    }

    function getPreflightThresholds(uint256 walletId)
        public
        view
        returns (PreflightThresholds memory)
    {
        PreflightThresholds memory thresholds = _thresholds[walletId];
        if (thresholds.exists) {
            return thresholds;
        }

        return PreflightThresholds({
            basicScore: 90,
            adversarialScore: 80,
            externalScore: 75,
            averageScore: 80,
            maxRiskScore: 25,
            freshnessSeconds: 600,
            exists: false
        });
    }

    function recordPreflight(PreflightInput calldata input) external {
        if (input.actionIntentHash == bytes32(0)) {
            revert MissingIntentHash();
        }

        if (_preflights[input.actionIntentHash].timestamp != 0) {
            revert PreflightAlreadyRecorded();
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

        _preflights[input.actionIntentHash] = PreflightRecord({
            walletId: input.walletId,
            actionIntentHash: input.actionIntentHash,
            modelHash: input.modelHash,
            harnessHash: input.harnessHash,
            policyHash: input.policyHash,
            toolsHash: input.toolsHash,
            suiteHash: input.suiteHash,
            basicScore: input.basicScore,
            adversarialScore: input.adversarialScore,
            externalScore: input.externalScore,
            averageScore: input.averageScore,
            maxRiskScore: input.maxRiskScore,
            passed: input.passed,
            timestamp: block.timestamp,
            reporter: msg.sender
        });

        emit PreflightRecorded(
            input.walletId,
            input.actionIntentHash,
            input.suiteHash,
            input.averageScore,
            input.passed,
            msg.sender
        );
    }

    function getPreflight(bytes32 actionIntentHash)
        external
        view
        returns (PreflightRecord memory)
    {
        PreflightRecord memory record = _preflights[actionIntentHash];
        if (record.timestamp == 0) {
            revert PreflightNotFound();
        }

        return record;
    }
}
