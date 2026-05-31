// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-8004-aligned identity registry: one ERC-721-style token per AI agent.
interface INexoraERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

contract NexoraAgentIdentityRegistry {
    string public constant name = "Nexora Agent Identity";
    string public constant symbol = "NXA";

    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    struct Agent {
        address owner;
        string agentURI;
        address agentWallet;
        uint64 createdAt;
    }

    address public immutable admin;
    uint256 private _nextAgentId = 1;

    mapping(uint256 agentId => Agent agent) private _agents;
    mapping(address owner => uint256 balance) private _balances;
    mapping(address owner => uint256[] agentIds) private _ownerAgents;
    mapping(uint256 agentId => address approved) private _tokenApprovals;
    mapping(address owner => mapping(address operator => bool approved)) private _operatorApprovals;
    mapping(address controller => bool enabled) public controllers;
    mapping(uint256 agentId => mapping(string metadataKey => bytes metadataValue)) private _metadata;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event AgentURIUpdated(uint256 indexed agentId, string agentURI);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletLinked(uint256 indexed agentId, address indexed wallet);
    event AgentWalletUnset(uint256 indexed agentId);
    event ControllerUpdated(address indexed controller, bool enabled);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );

    error AgentNotFound();
    error EmptyAgentURI();
    error InvalidAddress();
    error ReservedMetadataKey();
    error NotAuthorized();
    error UnsafeRecipient();

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert NotAuthorized();
        }
        _;
    }

    function setController(address controller, bool enabled) external onlyAdmin {
        if (controller == address(0)) {
            revert InvalidAddress();
        }

        controllers[controller] = enabled;
        emit ControllerUpdated(controller, enabled);
    }

    function registerAgent(string calldata agentURI) external returns (uint256 agentId) {
        return _registerAgent(msg.sender, agentURI, true);
    }

    function registerAgentFor(address owner, string calldata agentURI) external returns (uint256 agentId) {
        if (!controllers[msg.sender] && msg.sender != admin) {
            revert NotAuthorized();
        }

        return _registerAgent(owner, agentURI, true);
    }

    function register() external returns (uint256 agentId) {
        return _registerAgent(msg.sender, "", false);
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        return _registerAgent(msg.sender, agentURI, true);
    }

    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId) {
        agentId = _registerAgent(msg.sender, agentURI, true);
        _setMetadataEntries(agentId, metadata);
    }

    function updateAgentURI(uint256 agentId, string calldata agentURI) external {
        setAgentURI(agentId, agentURI);
    }

    function setAgentURI(uint256 agentId, string calldata agentURI) public {
        if (!_isApprovedOrOwner(msg.sender, agentId)) {
            revert NotAuthorized();
        }

        if (bytes(agentURI).length == 0) {
            revert EmptyAgentURI();
        }

        _agents[agentId].agentURI = agentURI;
        emit AgentURIUpdated(agentId, agentURI);
        emit URIUpdated(agentId, agentURI, msg.sender);
    }

    function linkWallet(uint256 agentId, address wallet) external {
        if (!_isApprovedOrOwner(msg.sender, agentId) && !controllers[msg.sender] && msg.sender != admin) {
            revert NotAuthorized();
        }

        if (wallet == address(0)) {
            revert InvalidAddress();
        }

        _agentOrRevert(agentId).agentWallet = wallet;
        emit AgentWalletLinked(agentId, wallet);
        _setMetadata(agentId, "agentWallet", abi.encode(wallet));
    }

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata) external {
        if (block.timestamp > deadline) {
            revert NotAuthorized();
        }

        if (!_isApprovedOrOwner(msg.sender, agentId)) {
            revert NotAuthorized();
        }

        if (newWallet == address(0)) {
            revert InvalidAddress();
        }

        _agents[agentId].agentWallet = newWallet;
        emit AgentWalletLinked(agentId, newWallet);
        _setMetadata(agentId, "agentWallet", abi.encode(newWallet));
    }

    function unsetAgentWallet(uint256 agentId) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) {
            revert NotAuthorized();
        }

        _agents[agentId].agentWallet = address(0);
        emit AgentWalletUnset(agentId);
        _setMetadata(agentId, "agentWallet", "");
    }

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) {
            revert NotAuthorized();
        }

        if (_isReservedMetadataKey(metadataKey)) {
            revert ReservedMetadataKey();
        }

        _setMetadata(agentId, metadataKey, metadataValue);
    }

    function approve(address approved, uint256 agentId) external {
        address owner = ownerOf(agentId);
        if (msg.sender != owner && !isApprovedForAll(owner, msg.sender)) {
            revert NotAuthorized();
        }

        _tokenApprovals[agentId] = approved;
        emit Approval(owner, approved, agentId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 agentId) public {
        if (!_isApprovedOrOwner(msg.sender, agentId)) {
            revert NotAuthorized();
        }

        if (to == address(0)) {
            revert InvalidAddress();
        }

        Agent storage agent = _agentOrRevert(agentId);
        if (agent.owner != from) {
            revert NotAuthorized();
        }

        _tokenApprovals[agentId] = address(0);
        _balances[from] -= 1;
        _balances[to] += 1;
        agent.owner = to;
        agent.agentWallet = address(0);
        _removeOwnerAgent(from, agentId);
        _ownerAgents[to].push(agentId);

        emit Transfer(from, to, agentId);
        emit AgentWalletUnset(agentId);
        _setMetadata(agentId, "agentWallet", "");
    }

    function safeTransferFrom(address from, address to, uint256 agentId) external {
        transferFrom(from, to, agentId);
        _checkOnERC721Received(from, to, agentId, "");
    }

    function safeTransferFrom(address from, address to, uint256 agentId, bytes calldata data) external {
        transferFrom(from, to, agentId);
        _checkOnERC721Received(from, to, agentId, data);
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) {
            revert InvalidAddress();
        }

        return _balances[owner];
    }

    function ownerOf(uint256 agentId) public view returns (address) {
        return _agentOrRevert(agentId).owner;
    }

    function tokenURI(uint256 agentId) external view returns (string memory) {
        return _agentOrRevert(agentId).agentURI;
    }

    function agentURIOf(uint256 agentId) external view returns (string memory) {
        return _agentOrRevert(agentId).agentURI;
    }

    function agentWalletOf(uint256 agentId) external view returns (address) {
        return _agentOrRevert(agentId).agentWallet;
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentOrRevert(agentId).agentWallet;
    }

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        _agentOrRevert(agentId);
        return _metadata[agentId][metadataKey];
    }

    function getApproved(uint256 agentId) external view returns (address) {
        _agentOrRevert(agentId);
        return _tokenApprovals[agentId];
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return _agentOrRevert(agentId);
    }

    function agentsOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }

    function _registerAgent(address owner, string memory agentURI, bool requireURI) private returns (uint256 agentId) {
        if (owner == address(0)) {
            revert InvalidAddress();
        }

        if (requireURI && bytes(agentURI).length == 0) {
            revert EmptyAgentURI();
        }

        agentId = _nextAgentId++;
        _agents[agentId] =
            Agent({owner: owner, agentURI: agentURI, agentWallet: owner, createdAt: uint64(block.timestamp)});
        _balances[owner] += 1;
        _ownerAgents[owner].push(agentId);

        emit Transfer(address(0), owner, agentId);
        emit Registered(agentId, agentURI, owner);
        _setMetadata(agentId, "agentWallet", abi.encode(owner));
    }

    function _isApprovedOrOwner(address spender, uint256 agentId) private view returns (bool) {
        address owner = ownerOf(agentId);
        return spender == owner || _tokenApprovals[agentId] == spender || isApprovedForAll(owner, spender);
    }

    function _agentOrRevert(uint256 agentId) private view returns (Agent storage agent) {
        agent = _agents[agentId];
        if (agent.owner == address(0)) {
            revert AgentNotFound();
        }
    }

    function _setMetadataEntries(uint256 agentId, MetadataEntry[] calldata metadata) private {
        for (uint256 i = 0; i < metadata.length; i++) {
            if (_isReservedMetadataKey(metadata[i].metadataKey)) {
                revert ReservedMetadataKey();
            }
            _setMetadata(agentId, metadata[i].metadataKey, metadata[i].metadataValue);
        }
    }

    function _setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) private {
        _agentOrRevert(agentId);
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function _isReservedMetadataKey(string memory metadataKey) private pure returns (bool) {
        return keccak256(bytes(metadataKey)) == keccak256(bytes("agentWallet"));
    }

    function _removeOwnerAgent(address owner, uint256 agentId) private {
        uint256[] storage ids = _ownerAgents[owner];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == agentId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                return;
            }
        }
    }

    function _checkOnERC721Received(address from, address to, uint256 agentId, bytes memory data) private {
        if (to.code.length == 0) {
            return;
        }

        try INexoraERC721Receiver(to).onERC721Received(msg.sender, from, agentId, data) returns (bytes4 retval) {
            if (retval != INexoraERC721Receiver.onERC721Received.selector) {
                revert UnsafeRecipient();
            }
        } catch {
            revert UnsafeRecipient();
        }
    }
}
