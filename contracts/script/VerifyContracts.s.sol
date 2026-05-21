// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Verification placeholder for the final Mantle deployment workflow.
/// @dev Mantle Explorer verification is normally driven by forge verify-contract
///      with broadcast addresses. This contract keeps the expected script file in
///      the repo without encoding environment-specific addresses.
contract VerifyContracts {
    function run() external pure returns (string memory) {
        return "Run forge verify-contract for each deployed Nexora address on Mantle Explorer.";
    }
}
