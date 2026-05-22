// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract NexoraSafeVault {
    mapping(address => uint256) private balances;
    uint256 private deposits;

    function deposit() external payable {
        require(msg.value > 0, "NO_MNT");
        balances[msg.sender] += msg.value;
        deposits += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "NO_AMOUNT");
        require(balances[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        balances[msg.sender] -= amount;
        deposits -= amount;
        payable(msg.sender).transfer(amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    function totalDeposits() external view returns (uint256) {
        return deposits;
    }

    function vaultName() external pure returns (string memory) {
        return "NexoraSafeVault";
    }

    function vaultRiskProfile() external pure returns (string memory) {
        return "low";
    }

    function expectedYieldBps() external pure returns (uint256) {
        return 240;
    }
}
