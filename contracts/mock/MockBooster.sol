pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./MockERC20.sol";
import "../interfaces/IConvex.sol";

contract MockBooster is IBooster {
    struct PoolInfo {
        address lptoken;
        address token;
        address gauge;
        address crvRewards;
        address stash;
        bool shutdown;
    }

    PoolInfo[] public override poolInfo;
    mapping(uint256 => mapping(address => uint256)) _balances;

    function addPool(
        address _lpToken,
        address _token,
        address _crvRewards
    ) external {
        poolInfo.push(
            PoolInfo({
                lptoken: _lpToken,
                token: _token,
                gauge: address(0),
                crvRewards: _crvRewards,
                stash: address(0),
                shutdown: false
            })
        );
    }

    function deposit(uint256 _pid, uint256 _amount, bool _stake) external override returns(bool) {
        PoolInfo memory pool = poolInfo[_pid];
        IERC20(pool.lptoken).transferFrom(msg.sender, address(this), _amount);
        if(_stake) {
            MockERC20(pool.token).mint(address(this), _amount);
            IERC20(pool.token).approve(pool.crvRewards, _amount);
            IRewards(pool.crvRewards).stakeFor(msg.sender, _amount);
        } else {
            MockERC20(pool.token).mint(msg.sender, _amount);
        }
        return true;
    }

    function withdraw(uint256 _pid, uint256 _amount) external override returns(bool) {
        PoolInfo memory pool = poolInfo[_pid];
        require(IERC20(pool.token).balanceOf(msg.sender) >= _amount, "Insufficient balance");
        MockERC20(pool.token).burnFrom(msg.sender, _amount);
        IERC20(pool.lptoken).transfer(msg.sender, _amount);
        return true;
    }

    function withdrawTo(uint256 _pid, uint256 _amount, address _to) external override returns(bool){
        address rewardContract = poolInfo[_pid].crvRewards;
        require(msg.sender == rewardContract,"!auth");

        _withdraw(_pid,_amount,msg.sender,_to);
        return true;
    }

    function _withdraw(uint256 _pid, uint256 _amount, address _from, address _to) internal returns(bool) {
        PoolInfo memory pool = poolInfo[_pid];
        require(IERC20(pool.token).balanceOf(_from) >= _amount, "Insufficient balance");
        MockERC20(pool.token).burnFrom(_from, _amount);
        IERC20(pool.lptoken).transfer(_to, _amount);
        return true;
    }

}