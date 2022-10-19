pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../interfaces/ICurve.sol";
import "../interfaces/IConvex.sol";

contract ArchebaseCurveToken is Initializable, ERC20Upgradeable {
    using SafeMathUpgradeable for uint;

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

    function initialize(
        address _voterAccount,
        uint256 _rewardLockedPercent,
        IBooster _booster,
        uint256 _boosterPoolId,
        address _crv,
        address _cvx
    ) external initializer {
        voterAccount = _voterAccount;
        rewardLockedPercent = _rewardLockedPercent;
        crv = _crv;
        cvx = _cvx;

        booster = _booster;
        boosterPoolId = _boosterPoolId;
        (address _metaToken,,,address crvRewards,,) = _booster.poolInfo(_boosterPoolId);
        metaToken = _metaToken;
        rewards = IRewards(crvRewards);

        string memory tokenName = string(abi.encodePacked('ArcheBase#', IERC20MetadataUpgradeable(_metaToken).name()));
        string memory tokenSymbol = string(abi.encodePacked('ARCB', IERC20MetadataUpgradeable(_metaToken).symbol()));
        __ERC20_init(tokenName, tokenSymbol);
    }

    function deposit(uint256 amount) external {
        _claimReward(msg.sender);
        // Stake token to convex
        ERC20Upgradeable(metaToken).transferFrom(msg.sender, address(this), amount);
        ERC20Upgradeable(metaToken).approve(address(booster), amount);
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
        IERC20Upgradeable(metaToken).transfer(msg.sender, amount);
    }

    function claimReward() external {
        _claimReward(msg.sender);
    }

    function _collectReward() internal {
        uint256 crvBalanceBefore = IERC20Upgradeable(crv).balanceOf(address(this));
        uint256 cvxBalanceBefore = IERC20Upgradeable(cvx).balanceOf(address(this));

        rewards.getReward();

        uint256 crvReward = IERC20Upgradeable(crv).balanceOf(address(this)).sub(crvBalanceBefore);
        uint256 cvxReward = IERC20Upgradeable(cvx).balanceOf(address(this)).sub(cvxBalanceBefore);
        if(crvReward > 0) {
            uint256 crvLocked = crvReward.mul(rewardLockedPercent).div(DECIMALS_REWARD_PERCENT);
            uint256 crvClaimable = crvReward.sub(crvLocked);
            crvRewardPerShare = crvRewardPerShare.add(crvClaimable.mul(DECIMALS_PER_SHARE).div(totalSupply()));
            IERC20Upgradeable(crv).transfer(voterAccount, crvLocked);
        }
        if(cvxReward > 0) {
            uint256 cvxLocked = cvxReward.mul(rewardLockedPercent).div(DECIMALS_REWARD_PERCENT);
            uint256 cvxClaimable = cvxReward.sub(cvxLocked);
            cvxRewardPerShare = cvxRewardPerShare.add(cvxClaimable.mul(DECIMALS_PER_SHARE).div(totalSupply()));
            IERC20Upgradeable(cvx).transfer(voterAccount, cvxLocked);
        }     
    }

    function _claimReward(address user) internal {
        _collectReward();
        uint256 perShareDeltaCrv = crvRewardPerShare.sub(crvRecentPerShare[user]);
        uint256 perShareDeltaCvx = cvxRewardPerShare.sub(cvxRecentPerShare[user]);
        crvRecentPerShare[user] = crvRewardPerShare;
        cvxRecentPerShare[user] = cvxRewardPerShare;
        uint256 balance = balanceOf(user);
        IERC20Upgradeable(crv).transfer(user, perShareDeltaCrv.mul(balance).div(DECIMALS_PER_SHARE));
        IERC20Upgradeable(cvx).transfer(user, perShareDeltaCvx.mul(balance).div(DECIMALS_PER_SHARE));
    }
}