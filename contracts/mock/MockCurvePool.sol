pragma solidity ^0.8.0;

import "../interfaces/ICurve.sol";
import "./WETH.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCurvePool is ICurvePool {
    address[2] public override coins;
    address public weth;

    constructor(address[2] memory _coins, address _weth) {
        coins = _coins;
        weth = _weth;
    }

    receive() external payable {}

    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy, bool use_eth, address payable _receiver) external payable override {
        address tokenIn = coins[i];
        address tokenOut = coins[j];
        if(tokenIn == weth) {
            WETH(weth).deposit{value: msg.value}();
        } else {
            IERC20(tokenIn).transferFrom(msg.sender, address(this), dx);
        }
        uint256 amountOut = dx;
        if(tokenOut == weth) {
            _receiver.transfer(amountOut);
        } else {
            IERC20(tokenOut).transfer(_receiver, amountOut);
        }
    }
}