// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentValidationRegistry} from "./NexoraAgentValidationRegistry.sol";

interface INexoraAgentReputationRecorder {
    function recordSignal(uint256 agentId, bool executed, bool policyViolation, uint16 riskScore, uint16 benchmarkScore)
        external;
}

interface INexoraEntryPointDeposit {
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
    function balanceOf(address account) external view returns (uint256);
}

library NexoraECDSA {
    error InvalidSignature();

    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function recover(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            revert InvalidSignature();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            revert InvalidSignature();
        }

        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) {
            revert InvalidSignature();
        }

        return recovered;
    }
}

contract Nexora4337AgentWallet {
    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID_VALUE = 0xffffffff;

    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;
        uint256 preVerificationGas;
        bytes32 gasFees;
        bytes paymasterAndData;
        bytes signature;
    }

    struct ExecutorPolicy {
        address executor;
        bool enabled;
        bool requirePreflight;
        uint256 maxValuePerAction;
        uint256 dailyLimit;
        uint64 validUntil;
    }

    address public immutable owner;
    uint256 public immutable agentId;
    address public immutable entryPoint;
    address public reputationRegistry;
    uint256 public nonce;

    ExecutorPolicy public executorPolicy;
    mapping(address target => bool allowed) public allowedTargets;
    mapping(address target => mapping(bytes4 selector => bool allowed)) public allowedTargetSelectors;
    mapping(uint256 day => uint256 spent) public spentByDay;
    mapping(bytes32 actionIntentHash => bool consumed) public consumedActionIntents;

    event Executed(address indexed target, uint256 value, bytes data, bytes result);
    event ExecutorPolicyUpdated(
        address indexed executor,
        bool enabled,
        bool requirePreflight,
        uint256 maxValuePerAction,
        uint256 dailyLimit,
        uint64 validUntil
    );
    event AllowedTargetUpdated(address indexed target, bool allowed);
    event AllowedSelectorUpdated(address indexed target, bytes4 indexed selector, bool allowed);
    event ActionIntentConsumed(bytes32 indexed actionIntentHash);
    event ReputationRegistryUpdated(address indexed reputationRegistry);
    event EntryPointDepositAdded(uint256 amount);
    event EntryPointDepositWithdrawn(address indexed to, uint256 amount);

    error ExecutionFailed();
    error IntentAlreadyConsumed();
    error InvalidNonce();
    error InvalidUserOperation();
    error NoEntryPoint();
    error NotAuthorized();
    error PreflightFailed();
    error PreflightScoreTooLow();
    error PreflightStale();
    error PreflightWalletMismatch();
    error RiskTooHigh();
    error SpendLimitExceeded();
    error SelectorNotAllowed();
    error TargetNotAllowed();

    constructor(
        address initialOwner,
        uint256 linkedAgentId,
        address entryPoint_,
        address reputationRegistry_,
        address safeVault,
        address volatileVault,
        address riskyVault
    ) {
        if (initialOwner == address(0)) {
            revert NotAuthorized();
        }

        owner = initialOwner;
        agentId = linkedAgentId;
        entryPoint = entryPoint_;
        reputationRegistry = reputationRegistry_;

        _allowBenchmarkVault(safeVault);
        _allowBenchmarkVault(volatileVault);
        _allowBenchmarkVault(riskyVault);
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotAuthorized();
        }
        _;
    }

    function setExecutorPolicy(
        address executor,
        bool enabled,
        bool requirePreflight,
        uint256 maxValuePerAction,
        uint256 dailyLimit,
        uint64 validUntil
    ) external onlyOwner {
        executorPolicy = ExecutorPolicy({
            executor: executor,
            enabled: enabled,
            requirePreflight: requirePreflight,
            maxValuePerAction: maxValuePerAction,
            dailyLimit: dailyLimit,
            validUntil: validUntil
        });

        emit ExecutorPolicyUpdated(executor, enabled, requirePreflight, maxValuePerAction, dailyLimit, validUntil);
    }

    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
        emit AllowedTargetUpdated(target, allowed);
    }

    function setAllowedSelector(address target, bytes4 selector, bool allowed) external onlyOwner {
        allowedTargetSelectors[target][selector] = allowed;
        emit AllowedSelectorUpdated(target, selector, allowed);
    }

    function setReputationRegistry(address reputationRegistry_) external onlyOwner {
        reputationRegistry = reputationRegistry_;
        emit ReputationRegistryUpdated(reputationRegistry_);
    }

    function _allowBenchmarkVault(address target) private {
        if (target == address(0)) {
            return;
        }

        allowedTargets[target] = true;
        allowedTargetSelectors[target][0xd0e30db0] = true;
        allowedTargetSelectors[target][0x2e1a7d4d] = true;
        emit AllowedTargetUpdated(target, true);
        emit AllowedSelectorUpdated(target, 0xd0e30db0, true);
        emit AllowedSelectorUpdated(target, 0x2e1a7d4d, true);
    }

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (entryPoint != address(0) && msg.sender != entryPoint) {
            revert NotAuthorized();
        }

        if (userOp.sender != address(this) || userOp.nonce != nonce) {
            return 1;
        }

        address signer = NexoraECDSA.recover(NexoraECDSA.toEthSignedMessageHash(userOpHash), userOp.signature);

        if (signer == owner) {
            nonce += 1;
            _payPrefund(missingAccountFunds);
            return 0;
        }

        if (signer == executorPolicy.executor) {
            _validateExecutorPolicyForCall(userOp.callData);
            nonce += 1;
            _payPrefund(missingAccountFunds);
            return _packValidationData(executorPolicy.validUntil, 0);
        }

        return 1;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        address signer = NexoraECDSA.recover(NexoraECDSA.toEthSignedMessageHash(hash), signature);

        if (signer == owner) {
            return ERC1271_MAGIC_VALUE;
        }

        ExecutorPolicy memory policy = executorPolicy;
        if (
            signer == policy.executor && policy.enabled && policy.executor != address(0)
                && (policy.validUntil == 0 || block.timestamp <= policy.validUntil)
        ) {
            return ERC1271_MAGIC_VALUE;
        }

        return ERC1271_INVALID_VALUE;
    }

    function addEntryPointDeposit() external payable onlyOwner {
        if (entryPoint == address(0)) {
            revert NoEntryPoint();
        }

        INexoraEntryPointDeposit(entryPoint).depositTo{value: msg.value}(address(this));
        emit EntryPointDepositAdded(msg.value);
    }

    function withdrawEntryPointDepositTo(address payable to, uint256 amount) external onlyOwner {
        if (entryPoint == address(0)) {
            revert NoEntryPoint();
        }

        INexoraEntryPointDeposit(entryPoint).withdrawTo(to, amount);
        emit EntryPointDepositWithdrawn(to, amount);
    }

    function entryPointDeposit() external view returns (uint256) {
        if (entryPoint == address(0)) {
            return 0;
        }

        return INexoraEntryPointDeposit(entryPoint).balanceOf(address(this));
    }

    function executeWithPreflight(
        address validationRegistry,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 actionIntentHash,
        uint16 riskScore
    ) external returns (bytes memory result) {
        if (msg.sender == owner) {
            result = _executePolicyChecked(validationRegistry, target, value, data, actionIntentHash, riskScore, false);
            return result;
        }

        if (msg.sender == entryPoint) {
            result = _executePolicyChecked(validationRegistry, target, value, data, actionIntentHash, riskScore, true);
            return result;
        }

        if (msg.sender == executorPolicy.executor) {
            result = _executePolicyChecked(validationRegistry, target, value, data, actionIntentHash, riskScore, true);
            return result;
        }

        revert NotAuthorized();
    }

    function executeWithPreflightByExecutor(
        address validationRegistry,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 actionIntentHash,
        uint16 riskScore
    ) external returns (bytes memory result) {
        if (msg.sender != executorPolicy.executor) {
            revert NotAuthorized();
        }

        result = _executePolicyChecked(validationRegistry, target, value, data, actionIntentHash, riskScore, true);
    }

    function _executePolicyChecked(
        address validationRegistry,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 actionIntentHash,
        uint16 riskScore,
        bool enforceExecutorPolicy
    ) private returns (bytes memory result) {
        if (consumedActionIntents[actionIntentHash]) {
            revert IntentAlreadyConsumed();
        }

        if (enforceExecutorPolicy) {
            _validateExecutorPolicy(target, value, data);
            _consumeSpend(value);
        } else {
            _validateAllowedTargetAndSelector(target, data);
        }

        NexoraAgentValidationRegistry.ValidationRecord memory preflight =
            _validatePreflight(validationRegistry, actionIntentHash, riskScore);

        bool success;
        (success, result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed();
        }

        consumedActionIntents[actionIntentHash] = true;
        emit ActionIntentConsumed(actionIntentHash);
        _recordReputation(preflight);
        emit Executed(target, value, data, result);
    }

    function _validateExecutorPolicyForCall(bytes calldata callData) private view {
        if (callData.length < 4) {
            revert InvalidUserOperation();
        }

        bytes4 selector = bytes4(callData[:4]);
        if (selector != this.executeWithPreflight.selector) {
            revert InvalidUserOperation();
        }

        (
            address validationRegistry,
            address target,
            uint256 value,
            bytes memory targetData,
            bytes32 actionIntentHash,
            uint16 riskScore
        ) = abi.decode(callData[4:], (address, address, uint256, bytes, bytes32, uint16));

        _validateExecutorPolicy(target, value, targetData);
        _validatePreflight(validationRegistry, actionIntentHash, riskScore);
    }

    function _validateExecutorPolicy(address target, uint256 value, bytes memory data) private view {
        ExecutorPolicy memory policy = executorPolicy;

        if (
            !policy.enabled || policy.executor == address(0)
                || (policy.validUntil != 0 && block.timestamp > policy.validUntil)
        ) {
            revert NotAuthorized();
        }

        _validateAllowedTargetAndSelector(target, data);

        if (value > policy.maxValuePerAction) {
            revert SpendLimitExceeded();
        }

        if (spentByDay[block.timestamp / 1 days] + value > policy.dailyLimit) {
            revert SpendLimitExceeded();
        }
    }

    function _consumeSpend(uint256 value) private {
        spentByDay[block.timestamp / 1 days] += value;
    }

    function _validatePreflight(address validationRegistry, bytes32 actionIntentHash, uint16 riskScore)
        private
        view
        returns (NexoraAgentValidationRegistry.ValidationRecord memory preflight)
    {
        NexoraAgentValidationRegistry registry = NexoraAgentValidationRegistry(validationRegistry);
        preflight = registry.getPreflight(actionIntentHash);
        NexoraAgentValidationRegistry.Thresholds memory thresholds = registry.getThresholds(agentId);

        if (preflight.actionIntentHash != actionIntentHash) {
            revert InvalidUserOperation();
        }

        if (preflight.agentId != agentId) {
            revert PreflightWalletMismatch();
        }

        if (!preflight.passed) {
            revert PreflightFailed();
        }

        if (block.timestamp >= preflight.timestamp + thresholds.freshnessSeconds) {
            revert PreflightStale();
        }

        if (
            preflight.basicScore < thresholds.basicScore || preflight.adversarialScore < thresholds.adversarialScore
                || preflight.externalScore < thresholds.externalScore || preflight.averageScore < thresholds.averageScore
        ) {
            revert PreflightScoreTooLow();
        }

        if (riskScore > thresholds.maxRiskScore || preflight.maxRiskScore > thresholds.maxRiskScore) {
            revert RiskTooHigh();
        }
    }

    function _validateAllowedTargetAndSelector(address target, bytes memory data) private view {
        if (!allowedTargets[target]) {
            revert TargetNotAllowed();
        }

        bytes4 selector = _selectorOf(data);
        if (!allowedTargetSelectors[target][selector]) {
            revert SelectorNotAllowed();
        }
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        if (data.length < 4) {
            return bytes4(0);
        }

        assembly {
            selector := mload(add(data, 0x20))
        }
    }

    function _recordReputation(NexoraAgentValidationRegistry.ValidationRecord memory preflight) private {
        address registry = reputationRegistry;
        if (registry == address(0)) {
            return;
        }

        try INexoraAgentReputationRecorder(registry).recordSignal(
            agentId, true, false, preflight.maxRiskScore, preflight.averageScore
        ) {} catch {}
    }

    function _packValidationData(uint64 validUntil, uint64 validAfter) private pure returns (uint256) {
        return uint256(validUntil) << 160 | uint256(validAfter) << 208;
    }

    function _payPrefund(uint256 missingAccountFunds) private {
        if (missingAccountFunds == 0) {
            return;
        }

        (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
        if (!success) {
            revert ExecutionFailed();
        }
    }
}
