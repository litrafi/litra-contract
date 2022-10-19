pragma solidity ^0.8.0;

import "./MockERC20.sol";
import "../interfaces/IConvex.sol";

contract MockRewards is IRewards {

    address public token;
    address public crv;
    address public cvx;
    address public operator;
    uint256 public pid;
    mapping(address => uint256) _balances;
    mapping(address => uint256) _lastClaimingTime;

    constructor(
        address _token,
        address _crv,
        address _cvx,
        address _operator,
        uint256 _pid
    ) {
        token = _token;
        crv = _crv;
        cvx = _cvx;
        operator = _operator;
        pid = _pid;
    }

    function getReward() external override {
        _getReward(msg.sender);
    }

    function stakeFor(address account, uint256 amount) external override {
        MockERC20(token).transferFrom(msg.sender, address(this), amount);
        _balances[account] += amount;
    }

    function withdraw(uint256 amount, bool claim) external override {
        if(claim) {
            _getReward(msg.sender);
        }
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        MockERC20(token).transfer(msg.sender, amount);
    }

    function withdrawAndUnwrap(uint256 amount, bool claim) external override returns(bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        IBooster(operator).withdrawTo(pid, amount, msg.sender);
    }

    function _getReward(address account) internal {
        uint256 rewardAmount = _balances[account] / 2000 * ((block.timestamp - _lastClaimingTime[account]) / 3600);
        MockERC20(crv).mint(account, rewardAmount);
        MockERC20(cvx).mint(account, rewardAmount);
        _lastClaimingTime[account] = block.timestamp;
    }
}