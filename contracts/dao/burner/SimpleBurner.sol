pragma solidity ^0.8.0;

import "../../interfaces/ICurve.sol";
import "../../interfaces/IBurner.sol";
import "../admin/Stoppable.sol";
import "../../interfaces/IDAO.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleBurner is Stoppable, IBurner {
    IFeeDistributor public receiver;
    address public weth;
    address public poolFactory;

    constructor(
        address _o,
        address _e,
        IFeeDistributor _receiver,
        address _weth,
        address _poolFactory
    ) OwnershipAdminManaged(_o) EmergencyAdminManaged(_e) {
        receiver = _receiver;
        weth = _weth;
        poolFactory = _poolFactory;
    }

    receive() external payable {}

    function burn(address _wnft) external override onlyNotStopped {
        uint256 inAmount = IERC20(_wnft).balanceOf(msg.sender);
        IERC20(_wnft).transferFrom(msg.sender, address(this), inAmount);
        // find pool
        address poolAddr = IPoolFactory(poolFactory).find_pool_for_coins(_wnft, weth);
        ICurvePool pool = ICurvePool(poolAddr);
        uint256 i;
        uint256 j;
        address token0 = pool.coins(0);
        if(token0 == _wnft) {
            i = 0;
            j = 1;
        } else {
            i = 1;
            j = 0;
        }
        // swap for eth
        IERC20(_wnft).approve(poolAddr, inAmount);
        pool.exchange(i, j, inAmount, 0, true, payable(this));
        uint256 balance = address(this).balance;
        receiver.burn{value: balance}();
    }
}