// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraSmartWalletRegistry} from "../src/NexoraSmartWalletRegistry.sol";

contract NexoraSmartWalletRegistryTest {
    NexoraSmartWalletRegistry private registry;

    function setUp() public {
        registry = new NexoraSmartWalletRegistry();
    }

    function testRegistersSmartWalletProfile() public {
        uint256 smartWalletId = registry.registerSmartWallet(
            "data:application/json,%7B%7D",
            keccak256("safe-approval"),
            0,
            0
        );

        NexoraSmartWalletRegistry.SmartWallet memory smartWallet =
            registry.getSmartWallet(smartWalletId);
        uint256[] memory ownerWallets = registry.smartWalletsOfOwner(address(this));

        assert(smartWalletId == 1);
        assert(smartWallet.owner == address(this));
        assert(smartWallet.wallet == address(0));
        assert(
            keccak256(bytes(smartWallet.metadataURI)) ==
                keccak256(bytes("data:application/json,%7B%7D"))
        );
        assert(smartWallet.harnessId == keccak256("safe-approval"));
        assert(ownerWallets.length == 1);
        assert(ownerWallets[0] == smartWalletId);
    }

    function testCreatesOneWalletForProfileOwner() public {
        uint256 smartWalletId = registry.registerSmartWallet(
            "data:application/json,%7B%7D",
            keccak256("safe-approval"),
            0,
            0
        );

        address wallet = registry.createSmartWallet(smartWalletId);
        address duplicateWallet = registry.createSmartWallet(smartWalletId);

        assert(wallet != address(0));
        assert(duplicateWallet == wallet);
        assert(registry.walletOfSmartWallet(smartWalletId) == wallet);
        assert(registry.smartWalletIdOfWallet(wallet) == smartWalletId);
    }

    function testRejectsNonOwnerWalletCreation() public {
        uint256 smartWalletId = registry.registerSmartWallet(
            "data:application/json,%7B%7D",
            keccak256("safe-approval"),
            0,
            0
        );
        SmartWalletRegistryAttacker attacker = new SmartWalletRegistryAttacker(registry);

        try attacker.create(smartWalletId) {
            revert("expected owner revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testOwnerCanUpdateMetadataAndHarness() public {
        uint256 smartWalletId = registry.registerSmartWallet(
            "data:application/json,%7B%7D",
            keccak256("safe-approval"),
            0,
            0
        );

        registry.updateMetadata(smartWalletId, "data:application/json,%7B%22name%22%3A%22New%22%7D");
        registry.updateHarness(smartWalletId, keccak256("wallet-defense"));

        NexoraSmartWalletRegistry.SmartWallet memory smartWallet =
            registry.getSmartWallet(smartWalletId);
        assert(
            keccak256(bytes(smartWallet.metadataURI)) ==
                keccak256(bytes("data:application/json,%7B%22name%22%3A%22New%22%7D"))
        );
        assert(smartWallet.harnessId == keccak256("wallet-defense"));
    }
}

contract SmartWalletRegistryAttacker {
    NexoraSmartWalletRegistry private immutable registry;

    constructor(NexoraSmartWalletRegistry registry_) {
        registry = registry_;
    }

    function create(uint256 smartWalletId) external returns (address) {
        return registry.createSmartWallet(smartWalletId);
    }
}
