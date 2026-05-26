// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraRiskyVault} from "../src/NexoraRiskyVault.sol";
import {NexoraSafeVault} from "../src/NexoraSafeVault.sol";
import {NexoraVolatileVault} from "../src/NexoraVolatileVault.sol";

contract NexoraBenchmarkVaultsTest {
    NexoraSafeVault private safeVault;
    NexoraRiskyVault private riskyVault;
    NexoraVolatileVault private volatileVault;

    receive() external payable {}

    function setUp() public {
        safeVault = new NexoraSafeVault();
        riskyVault = new NexoraRiskyVault();
        volatileVault = new NexoraVolatileVault();
    }

    function testSafeVaultAcceptsAndWithdrawsMnt() public {
        safeVault.deposit{value: 1 ether}();

        assert(safeVault.balanceOf(address(this)) == 1 ether);
        assert(safeVault.totalDeposits() == 1 ether);

        safeVault.withdraw(0.4 ether);

        assert(safeVault.balanceOf(address(this)) == 0.6 ether);
        assert(safeVault.totalDeposits() == 0.6 ether);
    }

    function testVaultMetadataMatchesBenchmarkProfiles() public view {
        assert(keccak256(bytes(safeVault.vaultName())) == keccak256("NexoraSafeVault"));
        assert(keccak256(bytes(safeVault.vaultRiskProfile())) == keccak256("low"));
        assert(safeVault.expectedYieldBps() == 240);

        assert(keccak256(bytes(riskyVault.vaultName())) == keccak256("NexoraRiskyVault"));
        assert(keccak256(bytes(riskyVault.vaultRiskProfile())) == keccak256("high"));
        assert(riskyVault.expectedYieldBps() == 1850);

        assert(keccak256(bytes(volatileVault.vaultName())) == keccak256("NexoraVolatileVault"));
        assert(keccak256(bytes(volatileVault.vaultRiskProfile())) == keccak256("medium"));
        assert(volatileVault.expectedYieldBps() == 720);
    }

    function testRejectsEmptyDeposit() public {
        try safeVault.deposit{value: 0}() {
            revert("expected empty deposit revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testRejectsExcessWithdraw() public {
        safeVault.deposit{value: 1 ether}();

        try safeVault.withdraw(2 ether) {
            revert("expected excess withdraw revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }
}
