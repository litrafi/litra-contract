pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

interface IUniswapPool is IUniswapV3Pool {
    function balance0() external view returns(uint256);
    function balance1() external view returns(uint256);
}