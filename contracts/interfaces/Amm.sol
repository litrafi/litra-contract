pragma solidity ^0.8.0;

interface AmmFactory {
    function getPair(address token0, address token1) external view returns(address);
}

interface AmmRouter {
    function factory() external view returns(address);
    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface AmmPair {
    function token0() external view returns(address);
    function token1() external view returns(address);
    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast);
}