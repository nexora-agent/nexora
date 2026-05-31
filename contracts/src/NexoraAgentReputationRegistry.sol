// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INexoraReputationIdentity {
    function ownerOf(uint256 agentId) external view returns (address);
    function getApproved(uint256 agentId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/// @notice ERC-8004-style reputation aggregates and feedback for Nexora agent identities.
contract NexoraAgentReputationRegistry {
    INexoraReputationIdentity public immutable identityRegistry;

    struct Reputation {
        uint256 benchmarkRuns;
        uint256 safeExecutions;
        uint256 blockedExecutions;
        uint256 policyViolations;
        uint256 totalRiskScore;
        uint256 totalBenchmarkScore;
        uint256 trustScore;
    }

    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    mapping(uint256 agentId => Reputation reputation) private _reputation;
    mapping(uint256 agentId => mapping(address client => mapping(uint64 index => Feedback feedback))) private _feedback;
    mapping(uint256 agentId => mapping(address client => uint64 index)) private _lastIndex;
    mapping(uint256 agentId => address[] clients) private _clients;
    mapping(uint256 agentId => mapping(address client => bool known)) private _knownClient;
    mapping(
        uint256 agentId
            => mapping(address client => mapping(uint64 index => mapping(address responder => uint64 count)))
    ) private _responseCount;

    event ReputationSignal(
        uint256 indexed agentId,
        bool executed,
        bool policyViolation,
        uint16 riskScore,
        uint16 benchmarkScore,
        uint256 trustScore,
        address indexed reporter
    );
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex,
        address responder,
        string responseURI,
        bytes32 responseHash
    );

    error InvalidScore();
    error InvalidClientFilter();
    error InvalidFeedback();
    error NotAllowedFeedback();

    constructor(address identityRegistry_) {
        identityRegistry = INexoraReputationIdentity(identityRegistry_);
    }

    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }

    function recordSignal(uint256 agentId, bool executed, bool policyViolation, uint16 riskScore, uint16 benchmarkScore)
        external
    {
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
            agentId, executed, policyViolation, riskScore, benchmarkScore, reputation.trustScore, msg.sender
        );
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        if (valueDecimals > 18) {
            revert InvalidFeedback();
        }

        if (!_canGiveFeedback(agentId, msg.sender)) {
            revert NotAllowedFeedback();
        }

        uint64 index = _lastIndex[agentId][msg.sender] + 1;
        _lastIndex[agentId][msg.sender] = index;
        _feedback[agentId][msg.sender][index] =
            Feedback({value: value, valueDecimals: valueDecimals, tag1: tag1, tag2: tag2, isRevoked: false});

        if (!_knownClient[agentId][msg.sender]) {
            _knownClient[agentId][msg.sender] = true;
            _clients[agentId].push(msg.sender);
        }

        _emitNewFeedback(agentId, index, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage feedback = _feedback[agentId][msg.sender][feedbackIndex];
        if (feedbackIndex == 0 || feedback.valueDecimals > 18 || feedback.isRevoked) {
            revert InvalidFeedback();
        }

        feedback.isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external {
        Feedback storage feedback = _feedback[agentId][clientAddress][feedbackIndex];
        if (feedbackIndex == 0 || feedback.valueDecimals > 18) {
            revert InvalidFeedback();
        }

        _responseCount[agentId][clientAddress][feedbackIndex][address(0)] += 1;
        _responseCount[agentId][clientAddress][feedbackIndex][msg.sender] += 1;
        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseURI, responseHash);
    }

    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        if (clientAddresses.length == 0) {
            revert InvalidClientFilter();
        }

        int256 total;
        bool hasDecimals;

        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 last = _lastIndex[agentId][client];

            for (uint64 index = 1; index <= last; index++) {
                Feedback storage feedback = _feedback[agentId][client][index];
                if (feedback.isRevoked) {
                    continue;
                }

                if (!_isEmpty(tag1) && !_stringEq(feedback.tag1, tag1)) {
                    continue;
                }

                if (!_isEmpty(tag2) && !_stringEq(feedback.tag2, tag2)) {
                    continue;
                }

                count += 1;
                total += feedback.value;
                if (!hasDecimals) {
                    summaryValueDecimals = feedback.valueDecimals;
                    hasDecimals = true;
                }
            }
        }

        if (count > 0) {
            summaryValue = int128(total / int256(uint256(count)));
        }
    }

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        Feedback storage feedback = _feedback[agentId][clientAddress][feedbackIndex];
        if (feedbackIndex == 0 || feedback.valueDecimals > 18) {
            revert InvalidFeedback();
        }

        return (feedback.value, feedback.valueDecimals, feedback.tag1, feedback.tag2, feedback.isRevoked);
    }

    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    )
        external
        view
        returns (
            address[] memory clients,
            uint64[] memory feedbackIndexes,
            int128[] memory values,
            uint8[] memory valueDecimals,
            string[] memory tag1s,
            string[] memory tag2s,
            bool[] memory revokedStatuses
        )
    {
        if (clientAddresses.length == 0) {
            revert InvalidClientFilter();
        }

        uint256 resultCount = _countMatchingFeedback(agentId, clientAddresses, tag1, tag2, includeRevoked);

        clients = new address[](resultCount);
        feedbackIndexes = new uint64[](resultCount);
        values = new int128[](resultCount);
        valueDecimals = new uint8[](resultCount);
        tag1s = new string[](resultCount);
        tag2s = new string[](resultCount);
        revokedStatuses = new bool[](resultCount);

        uint256 cursor;
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 last = _lastIndex[agentId][client];

            for (uint64 index = 1; index <= last; index++) {
                Feedback storage feedback = _feedback[agentId][client][index];
                if (!_matchesFeedback(feedback, tag1, tag2, includeRevoked)) {
                    continue;
                }

                clients[cursor] = client;
                feedbackIndexes[cursor] = index;
                values[cursor] = feedback.value;
                valueDecimals[cursor] = feedback.valueDecimals;
                tag1s[cursor] = feedback.tag1;
                tag2s[cursor] = feedback.tag2;
                revokedStatuses[cursor] = feedback.isRevoked;
                cursor += 1;
            }
        }
    }

    function getResponseCount(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        address[] calldata responders
    ) external view returns (uint64 count) {
        if (responders.length == 0) {
            return _responseCount[agentId][clientAddress][feedbackIndex][address(0)];
        }

        for (uint256 i = 0; i < responders.length; i++) {
            count += _responseCount[agentId][clientAddress][feedbackIndex][responders[i]];
        }
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return _lastIndex[agentId][clientAddress];
    }

    function getReputation(uint256 agentId) external view returns (Reputation memory) {
        return _reputation[agentId];
    }

    function _canGiveFeedback(uint256 agentId, address client) private view returns (bool) {
        address owner = identityRegistry.ownerOf(agentId);
        return client != owner && identityRegistry.getApproved(agentId) != client
            && !identityRegistry.isApprovedForAll(owner, client);
    }

    function _emitNewFeedback(
        uint256 agentId,
        uint64 index,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) private {
        emit NewFeedback(
            agentId, msg.sender, index, value, valueDecimals, tag1, tag1, tag2, endpoint, feedbackURI, feedbackHash
        );
    }

    function _countMatchingFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) private view returns (uint256 count) {
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 last = _lastIndex[agentId][client];

            for (uint64 index = 1; index <= last; index++) {
                if (_matchesFeedback(_feedback[agentId][client][index], tag1, tag2, includeRevoked)) {
                    count += 1;
                }
            }
        }
    }

    function _matchesFeedback(
        Feedback storage feedback,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) private view returns (bool) {
        if (!includeRevoked && feedback.isRevoked) {
            return false;
        }

        if (!_isEmpty(tag1) && !_stringEq(feedback.tag1, tag1)) {
            return false;
        }

        if (!_isEmpty(tag2) && !_stringEq(feedback.tag2, tag2)) {
            return false;
        }

        return true;
    }

    function _stringEq(string memory left, string memory right) private pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    function _isEmpty(string memory value) private pure returns (bool) {
        return bytes(value).length == 0;
    }
}
