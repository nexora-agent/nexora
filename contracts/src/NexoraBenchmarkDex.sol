// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INexoraBenchmarkToken {
    function balanceOf(address user) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract NexoraBenchmarkDex {
    INexoraBenchmarkToken public immutable token;
    string public constant dexName = "NexoraBenchmarkDex";
    uint256 public constant feeBps = 30;

    event LiquidityAdded(address indexed provider, uint256 mntAmount, uint256 tokenAmount);
    event MntSwappedForTokens(address indexed trader, uint256 mntIn, uint256 tokenOut);
    event TokensSwappedForMnt(address indexed trader, uint256 tokenIn, uint256 mntOut);

    constructor(address token_) {
        require(token_ != address(0), "TOKEN_ZERO");
        token = INexoraBenchmarkToken(token_);
    }

    receive() external payable {}

    function addLiquidity(uint256 tokenAmount) external payable {
        require(msg.value > 0, "NO_MNT");
        require(tokenAmount > 0, "NO_TOKEN");
        require(token.transferFrom(msg.sender, address(this), tokenAmount), "TOKEN_TRANSFER");
        emit LiquidityAdded(msg.sender, msg.value, tokenAmount);
    }

    function swapMntForTokens(uint256 minTokenOut) external payable returns (uint256 tokenOut) {
        require(msg.value > 0, "NO_MNT");
        uint256 mntReserveBefore = address(this).balance - msg.value;
        tokenOut = _quoteMntForTokens(msg.value, mntReserveBefore, token.balanceOf(address(this)));
        require(tokenOut >= minTokenOut, "SLIPPAGE");
        require(token.transfer(msg.sender, tokenOut), "TOKEN_TRANSFER");
        emit MntSwappedForTokens(msg.sender, msg.value, tokenOut);
    }

    function swapTokensForMnt(uint256 tokenAmount, uint256 minMntOut) external returns (uint256 mntOut) {
        require(tokenAmount > 0, "NO_TOKEN");
        mntOut = quoteTokensForMnt(tokenAmount);
        require(mntOut >= minMntOut, "SLIPPAGE");
        require(address(this).balance >= mntOut, "MNT_RESERVE");
        require(token.transferFrom(msg.sender, address(this), tokenAmount), "TOKEN_TRANSFER");
        payable(msg.sender).transfer(mntOut);
        emit TokensSwappedForMnt(msg.sender, tokenAmount, mntOut);
    }

    function quoteMntForTokens(uint256 mntIn) public view returns (uint256) {
        return _quoteMntForTokens(mntIn, address(this).balance, token.balanceOf(address(this)));
    }

    function _quoteMntForTokens(uint256 mntIn, uint256 mntReserve, uint256 tokenReserve) private pure returns (uint256) {
        if (mntIn == 0 || mntReserve == 0 || tokenReserve == 0) {
            return 0;
        }
        uint256 amountInWithFee = mntIn * (10_000 - feeBps);
        return (amountInWithFee * tokenReserve) / (mntReserve * 10_000 + amountInWithFee);
    }

    function quoteTokensForMnt(uint256 tokenIn) public view returns (uint256) {
        uint256 mntReserve = address(this).balance;
        uint256 tokenReserve = token.balanceOf(address(this));
        if (tokenIn == 0 || mntReserve == 0 || tokenReserve == 0) {
            return 0;
        }
        uint256 amountInWithFee = tokenIn * (10_000 - feeBps);
        return (amountInWithFee * mntReserve) / (tokenReserve * 10_000 + amountInWithFee);
    }

    function reserves() external view returns (uint256 mntReserve, uint256 tokenReserve) {
        return (address(this).balance, token.balanceOf(address(this)));
    }

    function benchmarkProfile() external pure returns (string memory) {
        return "constant-product testnet AMM for custom trading benchmarks";
    }
}
