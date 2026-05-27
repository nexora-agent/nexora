// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentValidationRegistry} from "./NexoraAgentValidationRegistry.sol";

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
    uint256 public nonce;

    ExecutorPolicy public executorPolicy;
    mapping(address target => bool allowed) public allowedTargets;
    mapping(uint256 day => uint256 spent) public spentByDay;

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

    error ExecutionFailed();
    error InvalidNonce();
    error InvalidUserOperation();
    error NotAuthorized();
    error PreflightFailed();
    error PreflightScoreTooLow();
    error PreflightStale();
    error PreflightWalletMismatch();
    error RiskTooHigh();
    error SpendLimitExceeded();
    error TargetNotAllowed();

    constructor(address initialOwner, uint256 linkedAgentId, address entryPoint_) {
        if (initialOwner == address(0)) {
            revert NotAuthorized();
        }

        owner = initialOwner;
        agentId = linkedAgentId;
        entryPoint = entryPoint_;
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

        emit ExecutorPolicyUpdated(
            executor,
            enabled,
            requirePreflight,
            maxValuePerAction,
            dailyLimit,
            validUntil
        );
    }

    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
        emit AllowedTargetUpdated(target, allowed);
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        if (entryPoint != address(0) && msg.sender != entryPoint) {
            revert NotAuthorized();
        }

        if (userOp.sender != address(this) || userOp.nonce != nonce) {
            return 1;
        }

        address signer = NexoraECDSA.recover(
            NexoraECDSA.toEthSignedMessageHash(userOpHash),
            userOp.signature
        );

        if (signer == owner) {
            nonce += 1;
            _payPrefund(missingAccountFunds);
            return 0;
        }

        if (signer == executorPolicy.executor) {
            _validateExecutorPolicyForCall(userOp.callData);
            nonce += 1;
            _payPrefund(missingAccountFunds);
            return 0;
        }

        return 1;
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
            result = _executePolicyChecked(
                validationRegistry,
                target,
                value,
                data,
                actionIntentHash,
                riskScore,
                false
            );
            return result;
        }

        if (msg.sender == entryPoint) {
            result = _executePolicyChecked(
                validationRegistry,
                target,
                value,
                data,
                actionIntentHash,
                riskScore,
                true
            );
            return result;
        }

        if (msg.sender == executorPolicy.executor) {
            result = _executePolicyChecked(
                validationRegistry,
                target,
                value,
                data,
                actionIntentHash,
                riskScore,
                true
            );
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

        result = _executePolicyChecked(
            validationRegistry,
            target,
            value,
            data,
            actionIntentHash,
            riskScore,
            true
        );
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
        if (enforceExecutorPolicy) {
            _validateExecutorPolicy(target, value);
            _consumeSpend(value);
        } else if (!allowedTargets[target]) {
            revert TargetNotAllowed();
        }

        _validatePreflight(validationRegistry, actionIntentHash, riskScore);

        bool success;
        (success, result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed();
        }

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
            ,
            bytes32 actionIntentHash,
            uint16 riskScore
        ) = abi.decode(
            callData[4:],
            (address, address, uint256, bytes, bytes32, uint16)
        );

        _validateExecutorPolicy(target, value);
        _validatePreflight(validationRegistry, actionIntentHash, riskScore);
    }

    function _validateExecutorPolicy(address target, uint256 value) private view {
        ExecutorPolicy memory policy = executorPolicy;

        if (
            !policy.enabled ||
            policy.executor == address(0) ||
            (policy.validUntil != 0 && block.timestamp > policy.validUntil)
        ) {
            revert NotAuthorized();
        }

        if (!allowedTargets[target]) {
            revert TargetNotAllowed();
        }

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

    function _validatePreflight(
        address validationRegistry,
        bytes32 actionIntentHash,
        uint16 riskScore
    ) private view {
        NexoraAgentValidationRegistry registry =
            NexoraAgentValidationRegistry(validationRegistry);
        NexoraAgentValidationRegistry.ValidationRecord memory preflight =
            registry.getPreflight(actionIntentHash);
        NexoraAgentValidationRegistry.Thresholds memory thresholds =
            registry.getThresholds(agentId);

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
            preflight.basicScore < thresholds.basicScore ||
            preflight.adversarialScore < thresholds.adversarialScore ||
            preflight.externalScore < thresholds.externalScore ||
            preflight.averageScore < thresholds.averageScore
        ) {
            revert PreflightScoreTooLow();
        }

        if (riskScore > thresholds.maxRiskScore || preflight.maxRiskScore > thresholds.maxRiskScore) {
            revert RiskTooHigh();
        }
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
