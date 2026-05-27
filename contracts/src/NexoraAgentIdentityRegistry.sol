// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-8004-aligned identity registry: one ERC-721-style token per AI agent.
contract NexoraAgentIdentityRegistry {
    string public constant name = "Nexora Agent Identity";
    string public constant symbol = "NXA";

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

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Registered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string agentURI);
    event AgentWalletLinked(uint256 indexed agentId, address indexed wallet);
    event ControllerUpdated(address indexed controller, bool enabled);

    error AgentNotFound();
    error EmptyAgentURI();
    error InvalidAddress();
    error NotAuthorized();

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
        return _registerAgent(msg.sender, agentURI);
    }

    function registerAgentFor(address owner, string calldata agentURI)
        external
        returns (uint256 agentId)
    {
        if (!controllers[msg.sender] && msg.sender != admin) {
            revert NotAuthorized();
        }

        return _registerAgent(owner, agentURI);
    }

    function updateAgentURI(uint256 agentId, string calldata agentURI) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) {
            revert NotAuthorized();
        }

        if (bytes(agentURI).length == 0) {
            revert EmptyAgentURI();
        }

        _agents[agentId].agentURI = agentURI;
        emit AgentURIUpdated(agentId, agentURI);
    }

    function linkWallet(uint256 agentId, address wallet) external {
        if (
            !_isApprovedOrOwner(msg.sender, agentId) &&
            !controllers[msg.sender] &&
            msg.sender != admin
        ) {
            revert NotAuthorized();
        }

        if (wallet == address(0)) {
            revert InvalidAddress();
        }

        _agentOrRevert(agentId).agentWallet = wallet;
        emit AgentWalletLinked(agentId, wallet);
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
        _ownerAgents[to].push(agentId);

        emit Transfer(from, to, agentId);
    }

    function safeTransferFrom(address from, address to, uint256 agentId) external {
        transferFrom(from, to, agentId);
    }

    function safeTransferFrom(address from, address to, uint256 agentId, bytes calldata)
        external
    {
        transferFrom(from, to, agentId);
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

    function _registerAgent(address owner, string calldata agentURI)
        private
        returns (uint256 agentId)
    {
        if (owner == address(0)) {
            revert InvalidAddress();
        }

        if (bytes(agentURI).length == 0) {
            revert EmptyAgentURI();
        }

        agentId = _nextAgentId++;
        _agents[agentId] = Agent({
            owner: owner,
            agentURI: agentURI,
            agentWallet: address(0),
            createdAt: uint64(block.timestamp)
        });
        _balances[owner] += 1;
        _ownerAgents[owner].push(agentId);

        emit Transfer(address(0), owner, agentId);
        emit Registered(agentId, owner, agentURI);
    }

    function _isApprovedOrOwner(address spender, uint256 agentId)
        private
        view
        returns (bool)
    {
        address owner = ownerOf(agentId);
        return spender == owner ||
            _tokenApprovals[agentId] == spender ||
            isApprovedForAll(owner, spender);
    }

    function _agentOrRevert(uint256 agentId) private view returns (Agent storage agent) {
        agent = _agents[agentId];
        if (agent.owner == address(0)) {
            revert AgentNotFound();
        }
    }
}
