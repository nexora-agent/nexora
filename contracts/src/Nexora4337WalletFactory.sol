// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nexora4337AgentWallet} from "./Nexora4337AgentWallet.sol";
import {NexoraAgentIdentityRegistry} from "./NexoraAgentIdentityRegistry.sol";

/// @notice Mints an agent identity and deploys its ERC-4337-compatible wallet.
contract Nexora4337WalletFactory {
    NexoraAgentIdentityRegistry public immutable identityRegistry;
    address public immutable entryPoint;
    address public immutable reputationRegistry;
    address public immutable safeVault;
    address public immutable volatileVault;
    address public immutable riskyVault;

    mapping(uint256 agentId => address wallet) public walletOfAgent;

    event AgentWalletCreated(uint256 indexed agentId, address indexed owner, address indexed wallet, string agentURI);

    error WalletAlreadyCreated();

    constructor(
        address identityRegistry_,
        address entryPoint_,
        address reputationRegistry_,
        address safeVault_,
        address volatileVault_,
        address riskyVault_
    ) {
        identityRegistry = NexoraAgentIdentityRegistry(identityRegistry_);
        entryPoint = entryPoint_;
        reputationRegistry = reputationRegistry_;
        safeVault = safeVault_;
        volatileVault = volatileVault_;
        riskyVault = riskyVault_;
    }

    function createAgentWallet(string calldata agentURI, bytes32 salt)
        external
        returns (uint256 agentId, address wallet)
    {
        agentId = identityRegistry.registerAgentFor(msg.sender, agentURI);
        wallet = _deployWallet(msg.sender, agentId, salt);
        identityRegistry.linkWallet(agentId, wallet);
        walletOfAgent[agentId] = wallet;

        emit AgentWalletCreated(agentId, msg.sender, wallet, agentURI);
    }

    function predictWalletAddress(address owner, uint256 agentId, bytes32 salt) external view returns (address) {
        bytes32 finalSalt = keccak256(abi.encode(owner, agentId, salt));
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(Nexora4337AgentWallet).creationCode,
                abi.encode(owner, agentId, entryPoint, reputationRegistry, safeVault, volatileVault, riskyVault)
            )
        );

        return
            address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), finalSalt, bytecodeHash)))));
    }

    function _deployWallet(address owner, uint256 agentId, bytes32 salt) private returns (address wallet) {
        if (walletOfAgent[agentId] != address(0)) {
            revert WalletAlreadyCreated();
        }

        wallet = address(
            new Nexora4337AgentWallet{salt: keccak256(abi.encode(owner, agentId, salt))}(
                owner, agentId, entryPoint, reputationRegistry, safeVault, volatileVault, riskyVault
            )
        );
    }
}
