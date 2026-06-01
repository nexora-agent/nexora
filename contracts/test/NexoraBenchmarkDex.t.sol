// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NexoraBenchmarkDex} from "../src/NexoraBenchmarkDex.sol";
import {NexoraBenchmarkToken} from "../src/NexoraBenchmarkToken.sol";

interface DexVm {
    function addr(uint256 privateKey) external returns (address);
    function deal(address who, uint256 newBalance) external;
    function prank(address) external;
}

contract NexoraBenchmarkDexTest {
    DexVm private constant vm = DexVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    NexoraBenchmarkDex private dex;
    NexoraBenchmarkToken private token;
    address private liquidityProvider;
    address private trader;

    function setUp() public {
        liquidityProvider = vm.addr(0xA11CE);
        trader = vm.addr(0xB0B);
        vm.deal(liquidityProvider, 100 ether);
        vm.deal(trader, 10 ether);

        token = new NexoraBenchmarkToken("Nexora Benchmark USD", "nUSD", 1_000_000 ether, liquidityProvider);
        dex = new NexoraBenchmarkDex(address(token));

        vm.prank(liquidityProvider);
        token.approve(address(dex), 500_000 ether);
        vm.prank(liquidityProvider);
        dex.addLiquidity{value: 50 ether}(500_000 ether);
    }

    function testQuotesAndSwapsMntForTokens() public {
        uint256 quote = dex.quoteMntForTokens(1 ether);
        assert(quote > 0);

        uint256 beforeBalance = token.balanceOf(trader);
        vm.prank(trader);
        uint256 tokenOut = dex.swapMntForTokens{value: 1 ether}(quote * 99 / 100);

        assert(tokenOut > 0);
        assert(token.balanceOf(trader) == beforeBalance + tokenOut);
    }

    function testRejectsSlippageExceeded() public {
        uint256 quote = dex.quoteMntForTokens(1 ether);
        vm.prank(trader);
        try dex.swapMntForTokens{value: 1 ether}(quote + 1) {
            revert("expected slippage revert");
        } catch (bytes memory reason) {
            assert(reason.length > 0);
        }
    }

    function testSwapsTokensForMnt() public {
        vm.prank(trader);
        dex.swapMntForTokens{value: 1 ether}(1);
        uint256 tokenBalance = token.balanceOf(trader);
        uint256 quote = dex.quoteTokensForMnt(tokenBalance / 2);

        vm.prank(trader);
        token.approve(address(dex), tokenBalance / 2);
        uint256 beforeMnt = trader.balance;
        vm.prank(trader);
        uint256 mntOut = dex.swapTokensForMnt(tokenBalance / 2, quote * 99 / 100);

        assert(mntOut > 0);
        assert(trader.balance == beforeMnt + mntOut);
    }
}
