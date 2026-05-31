// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraAgentWallet} from "./NexoraAgentWallet.sol";

/// @notice Canonical registry for Nexora smart wallet profiles and deployed wallets.
contract NexoraSmartWalletRegistry {
    string public constant name = "Nexora Smart Wallet Registry";

    struct SmartWallet {
        address owner;
        address wallet;
        string metadataURI;
        bytes32 harnessId;
        uint8 riskMode;
        uint8 runnerMode;
        uint64 createdAt;
        uint64 walletCreatedAt;
    }

    uint256 private _nextSmartWalletId = 1;

    mapping(uint256 smartWalletId => SmartWallet smartWallet) private _smartWallets;
    mapping(address owner => uint256[] smartWalletIds) private _ownerSmartWallets;
    mapping(address wallet => uint256 smartWalletId) public smartWalletIdOfWallet;

    event SmartWalletRegistered(
        uint256 indexed smartWalletId,
        address indexed owner,
        string metadataURI,
        bytes32 harnessId,
        uint8 riskMode,
        uint8 runnerMode
    );
    event SmartWalletCreated(uint256 indexed smartWalletId, address indexed owner, address wallet);
    event SmartWalletMetadataUpdated(uint256 indexed smartWalletId, string metadataURI);
    event SmartWalletHarnessUpdated(uint256 indexed smartWalletId, bytes32 harnessId);

    error EmptyMetadataURI();
    error InvalidMode();
    error NotSmartWalletOwner();
    error SmartWalletNotFound();

    function registerSmartWallet(string calldata metadataURI, bytes32 harnessId, uint8 riskMode, uint8 runnerMode)
        external
        returns (uint256 smartWalletId)
    {
        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        if (riskMode > 2 || runnerMode > 2) {
            revert InvalidMode();
        }

        smartWalletId = _nextSmartWalletId++;
        _smartWallets[smartWalletId] = SmartWallet({
            owner: msg.sender,
            wallet: address(0),
            metadataURI: metadataURI,
            harnessId: harnessId,
            riskMode: riskMode,
            runnerMode: runnerMode,
            createdAt: uint64(block.timestamp),
            walletCreatedAt: 0
        });
        _ownerSmartWallets[msg.sender].push(smartWalletId);

        emit SmartWalletRegistered(smartWalletId, msg.sender, metadataURI, harnessId, riskMode, runnerMode);
    }

    function createSmartWallet(uint256 smartWalletId) external returns (address wallet) {
        SmartWallet storage smartWallet = _smartWalletOrRevert(smartWalletId);
        if (smartWallet.owner != msg.sender) {
            revert NotSmartWalletOwner();
        }

        wallet = smartWallet.wallet;
        if (wallet != address(0)) {
            return wallet;
        }

        wallet = address(new NexoraAgentWallet(msg.sender, smartWalletId));
        smartWallet.wallet = wallet;
        smartWallet.walletCreatedAt = uint64(block.timestamp);
        smartWalletIdOfWallet[wallet] = smartWalletId;

        emit SmartWalletCreated(smartWalletId, msg.sender, wallet);
    }

    function updateMetadata(uint256 smartWalletId, string calldata metadataURI) external {
        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        SmartWallet storage smartWallet = _smartWalletOrRevert(smartWalletId);
        if (smartWallet.owner != msg.sender) {
            revert NotSmartWalletOwner();
        }

        smartWallet.metadataURI = metadataURI;
        emit SmartWalletMetadataUpdated(smartWalletId, metadataURI);
    }

    function updateHarness(uint256 smartWalletId, bytes32 harnessId) external {
        SmartWallet storage smartWallet = _smartWalletOrRevert(smartWalletId);
        if (smartWallet.owner != msg.sender) {
            revert NotSmartWalletOwner();
        }

        smartWallet.harnessId = harnessId;
        emit SmartWalletHarnessUpdated(smartWalletId, harnessId);
    }

    function getSmartWallet(uint256 smartWalletId) external view returns (SmartWallet memory) {
        return _smartWalletOrRevert(smartWalletId);
    }

    function ownerOfSmartWallet(uint256 smartWalletId) external view returns (address) {
        return _smartWalletOrRevert(smartWalletId).owner;
    }

    function walletOfSmartWallet(uint256 smartWalletId) external view returns (address) {
        return _smartWalletOrRevert(smartWalletId).wallet;
    }

    function metadataURIOf(uint256 smartWalletId) external view returns (string memory) {
        return _smartWalletOrRevert(smartWalletId).metadataURI;
    }

    function smartWalletsOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownerSmartWallets[owner];
    }

    function nextSmartWalletId() external view returns (uint256) {
        return _nextSmartWalletId;
    }

    function _smartWalletOrRevert(uint256 smartWalletId) private view returns (SmartWallet storage smartWallet) {
        smartWallet = _smartWallets[smartWalletId];
        if (smartWallet.owner == address(0)) {
            revert SmartWalletNotFound();
        }
    }
}
