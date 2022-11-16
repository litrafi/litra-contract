pragma solidity ^0.8.0;

import "./MockCurvePool.sol";
import "../interfaces/ICurve.sol";

contract MockPoolFactory is IPoolFactory {
    mapping(address => mapping(address => address)) public override find_pool_for_coins;
    address public weth;

    constructor(address _weth) {
        weth = _weth;
    }

    function deployPool(address _from, address _to) external {
        address pool = address(new MockCurvePool([_from, _to], weth));
        find_pool_for_coins[_from][_to] = pool;
        find_pool_for_coins[_to][_from] = pool;
    }
}