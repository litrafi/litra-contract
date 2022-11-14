pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/ICurve.sol";
import "../interfaces/IConvex.sol";

contract ArchebaseCVXToken is ERC20 {
    uint256 constant public DECIMALS_REWARD_PERCENT = 1e6;
    uint256 constant public DECIMALS_PER_SHARE = 1e18;

    address public voterAccount;

    IBooster public booster;
    IRewards public rewards;
    address public metaToken;
    uint256 public boosterPoolId;

    address public crv;
    address public cvx;
    uint256 public crvRewardPerShare;
    uint256 public cvxRewardPerShare;
    // user => amount
    mapping(address => uint256) public crvRecentPerShare;
    mapping(address => uint256) public cvxRecentPerShare;

    uint256 public rewardLockedPercent;

    string private name_;
    string private symbol_;

    constructor(
        address _voterAccount,
        uint256 _rewardLockedPercent,
        IBooster _booster,
        uint256 _boosterPoolId,
        address _crv,
        address _cvx
    ) ERC20('', '') {
        voterAccount = _voterAccount;
        rewardLockedPercent = _rewardLockedPercent;
        crv = _crv;
        cvx = _cvx;

        booster = _booster;
        boosterPoolId = _boosterPoolId;
        (address _metaToken,,,address crvRewards,,) = _booster.poolInfo(_boosterPoolId);
        metaToken = _metaToken;
        rewards = IRewards(crvRewards);

        name_ = string(abi.encodePacked('ArcheBase#', IERC20Metadata(_metaToken).name()));
        symbol_ = string(abi.encodePacked('ARCB', IERC20Metadata(_metaToken).symbol()));
    }

    function deposit(uint256 amount) external {
        _claimReward(msg.sender);
        // Stake token to convex
        ERC20(metaToken).transferFrom(msg.sender, address(this), amount);
        ERC20(metaToken).approve(address(booster), amount);
        booster.deposit(boosterPoolId, amount, true);
        // mint ARCBCRV
        _mint(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        _claimReward(msg.sender);
        _burn(msg.sender, amount);
        // Withdraw from Rewards
        rewards.withdrawAndUnwrap(amount, false);
        // Transfer to user
        IERC20(metaToken).transfer(msg.sender, amount);
    }

    function claimReward() external {
        _claimReward(msg.sender);
    }

    function _collectReward() internal {
        uint256 crvBalanceBefore = IERC20(crv).balanceOf(address(this));
        uint256 cvxBalanceBefore = IERC20(cvx).balanceOf(address(this));

        rewards.getReward();

        uint256 crvReward = IERC20(crv).balanceOf(address(this)) - crvBalanceBefore;
        uint256 cvxReward = IERC20(cvx).balanceOf(address(this)) - cvxBalanceBefore;
        if(crvReward > 0) {
            uint256 crvLocked = crvReward * rewardLockedPercent / DECIMALS_REWARD_PERCENT;
            uint256 crvClaimable = crvReward - crvLocked;
            crvRewardPerShare = crvRewardPerShare + crvClaimable * DECIMALS_PER_SHARE / totalSupply();
            IERC20(crv).transfer(voterAccount, crvLocked);
        }
        if(cvxReward > 0) {
            uint256 cvxLocked = cvxReward * rewardLockedPercent / DECIMALS_REWARD_PERCENT;
            uint256 cvxClaimable = cvxReward - cvxLocked;
            cvxRewardPerShare = cvxRewardPerShare + cvxClaimable * DECIMALS_PER_SHARE / totalSupply();
            IERC20(cvx).transfer(voterAccount, cvxLocked);
        }     
    }

    function _claimReward(address user) internal {
        _collectReward();
        uint256 perShareDeltaCrv = crvRewardPerShare - crvRecentPerShare[user];
        uint256 perShareDeltaCvx = cvxRewardPerShare - cvxRecentPerShare[user];
        crvRecentPerShare[user] = crvRewardPerShare;
        cvxRecentPerShare[user] = cvxRewardPerShare;
        uint256 balance = balanceOf(user);
        IERC20(crv).transfer(user, perShareDeltaCrv * balance / DECIMALS_PER_SHARE);
        IERC20(cvx).transfer(user, perShareDeltaCvx * balance / DECIMALS_PER_SHARE);
    }
}