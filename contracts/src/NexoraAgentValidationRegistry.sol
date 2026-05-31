// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INexoraAgentIdentityOwner {
    function ownerOf(uint256 agentId) external view returns (address);
    function getApproved(uint256 agentId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
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

    struct ValidationStatus {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
        bool exists;
    }

    struct ValidationRequestData {
        address validatorAddress;
        uint256 agentId;
        string requestURI;
        bytes32 requestHash;
        bool exists;
    }

    mapping(bytes32 actionIntentHash => ValidationRecord record) private _records;
    mapping(uint256 agentId => Thresholds thresholds) private _thresholds;
    mapping(uint256 agentId => bytes32[] actionIntentHashes) private _agentRecords;
    mapping(bytes32 requestHash => ValidationRequestData request) private _validationRequests;
    mapping(bytes32 requestHash => ValidationStatus status) private _validationStatuses;
    mapping(uint256 agentId => bytes32[] requestHashes) private _agentValidationRequests;
    mapping(address validator => bytes32[] requestHashes) private _validatorRequests;
    mapping(uint256 agentId => mapping(address reporter => bool enabled)) public authorizedReporters;

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
    event ValidationRequest(
        address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash
    );
    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );
    event ReporterUpdated(uint256 indexed agentId, address indexed reporter, bool enabled);

    error InvalidScore();
    error MissingIntentHash();
    error NotAuthorizedReporter();
    error NotAgentOwner();
    error NotValidator();
    error ValidationAlreadyRecorded();
    error ValidationNotFound();

    constructor(address identityRegistry_) {
        identityRegistry = INexoraAgentIdentityOwner(identityRegistry_);
    }

    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        if (!_isAgentOwnerOrOperator(agentId, msg.sender)) {
            revert NotAgentOwner();
        }

        if (validatorAddress == address(0) || requestHash == bytes32(0)) {
            revert MissingIntentHash();
        }

        _storeValidationRequest(validatorAddress, agentId, requestURI, requestHash);

        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }

    function setReporter(uint256 agentId, address reporter, bool enabled) external {
        if (!_isAgentOwnerOrOperator(agentId, msg.sender)) {
            revert NotAgentOwner();
        }

        if (reporter == address(0)) {
            revert NotAuthorizedReporter();
        }

        authorizedReporters[agentId][reporter] = enabled;
        emit ReporterUpdated(agentId, reporter, enabled);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        ValidationRequestData memory request = _validationRequests[requestHash];
        if (!request.exists) {
            revert ValidationNotFound();
        }

        if (request.validatorAddress != msg.sender) {
            revert NotValidator();
        }

        if (response > 100) {
            revert InvalidScore();
        }

        _validationStatuses[requestHash] = ValidationStatus({
            validatorAddress: msg.sender,
            agentId: request.agentId,
            response: response,
            responseHash: responseHash,
            tag: tag,
            lastUpdate: block.timestamp,
            exists: true
        });

        emit ValidationResponse(msg.sender, request.agentId, requestHash, response, responseURI, responseHash, tag);
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
            basicScore > 100 || adversarialScore > 100 || externalScore > 100 || averageScore > 100
                || maxRiskScore > 100 || freshnessSeconds == 0
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
            agentId, basicScore, adversarialScore, externalScore, averageScore, maxRiskScore, freshnessSeconds
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
        if (!_isAgentOwnerOrOperator(input.agentId, msg.sender) && !authorizedReporters[input.agentId][msg.sender]) {
            revert NotAuthorizedReporter();
        }

        if (input.actionIntentHash == bytes32(0)) {
            revert MissingIntentHash();
        }

        if (_records[input.actionIntentHash].timestamp != 0) {
            revert ValidationAlreadyRecorded();
        }

        if (
            input.basicScore > 100 || input.adversarialScore > 100 || input.externalScore > 100
                || input.averageScore > 100 || input.maxRiskScore > 100
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

        if (!_validationRequests[input.actionIntentHash].exists) {
            _storeValidationRequest(msg.sender, input.agentId, "", input.actionIntentHash);
        }

        _validationStatuses[input.actionIntentHash] = ValidationStatus({
            validatorAddress: msg.sender,
            agentId: input.agentId,
            response: input.passed ? uint8(input.averageScore) : 0,
            responseHash: input.reportHash,
            tag: "nexora-preflight",
            lastUpdate: block.timestamp,
            exists: true
        });

        emit ValidationRecorded(
            input.agentId, input.actionIntentHash, input.reportHash, input.averageScore, input.passed, msg.sender
        );

        emit ValidationResponse(
            msg.sender,
            input.agentId,
            input.actionIntentHash,
            input.passed ? uint8(input.averageScore) : 0,
            "",
            input.reportHash,
            "nexora-preflight"
        );
    }

    function getPreflight(bytes32 actionIntentHash) external view returns (ValidationRecord memory) {
        return getValidation(actionIntentHash);
    }

    function getValidation(bytes32 actionIntentHash) public view returns (ValidationRecord memory) {
        ValidationRecord memory record = _records[actionIntentHash];
        if (record.timestamp == 0) {
            revert ValidationNotFound();
        }

        return record;
    }

    function validationsOfAgent(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentRecords[agentId];
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        ValidationStatus memory status = _validationStatuses[requestHash];
        if (!status.exists) {
            revert ValidationNotFound();
        }

        return (
            status.validatorAddress, status.agentId, status.response, status.responseHash, status.tag, status.lastUpdate
        );
    }

    function getSummary(uint256 agentId, address[] calldata validatorAddresses, string calldata tag)
        external
        view
        returns (uint64 count, uint8 averageResponse)
    {
        bytes32[] storage hashes = _agentValidationRequests[agentId];
        uint256 total;

        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationStatus storage status = _validationStatuses[hashes[i]];
            if (!status.exists) {
                continue;
            }

            if (!_matchesValidator(status.validatorAddress, validatorAddresses)) {
                continue;
            }

            if (!_isEmpty(tag) && !_stringEq(status.tag, tag)) {
                continue;
            }

            count += 1;
            total += status.response;
        }

        if (count > 0) {
            averageResponse = uint8(total / count);
        }
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidationRequests[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return _validatorRequests[validatorAddress];
    }

    function _storeValidationRequest(
        address validatorAddress,
        uint256 agentId,
        string memory requestURI,
        bytes32 requestHash
    ) private {
        if (_validationRequests[requestHash].exists) {
            return;
        }

        _validationRequests[requestHash] = ValidationRequestData({
            validatorAddress: validatorAddress,
            agentId: agentId,
            requestURI: requestURI,
            requestHash: requestHash,
            exists: true
        });
        _agentValidationRequests[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);
    }

    function _isAgentOwnerOrOperator(uint256 agentId, address caller) private view returns (bool) {
        address owner = identityRegistry.ownerOf(agentId);
        return caller == owner || identityRegistry.getApproved(agentId) == caller
            || identityRegistry.isApprovedForAll(owner, caller);
    }

    function _matchesValidator(address validator, address[] calldata validators) private pure returns (bool) {
        if (validators.length == 0) {
            return true;
        }

        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                return true;
            }
        }

        return false;
    }

    function _stringEq(string memory left, string memory right) private pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    function _isEmpty(string memory value) private pure returns (bool) {
        return bytes(value).length == 0;
    }
}
