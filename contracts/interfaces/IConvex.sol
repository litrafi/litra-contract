pragma solidity ^0.8.0;

interface IBooster {
    function poolInfo(uint256 index) external view returns(address, address, address, address, address, bool);
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns(bool);
    function withdraw(uint256 _pid, uint256 _amount) external returns(bool);
    function withdrawTo(uint256 _pid, uint256 _amount, address _to) external returns(bool);
}

interface IRewards{
    // function stake(address, uint256) external;
    function stakeFor(address, uint256) external;
    function withdraw(uint256 amount, bool claim) external;
    // function exit(address) external;
    function getReward() external;
    // function queueNewRewards(uint256) external;
    // function notifyRewardAmount(uint256) external;
    // function addExtraReward(address) external;
    // function stakingToken() external view returns (address);
    // function rewardToken() external view returns(address);
    // function earned(address account) external view returns (uint256);
    function withdrawAndUnwrap(uint256 amount, bool claim) external returns(bool);
}

interface ILockedCvx{
    struct LockedBalance {
        uint112 amount;
        uint112 boosted;
        uint32 unlockTime;
    }

    function lock(address _account, uint256 _amount, uint256 _spendRatio) external;
    function processExpiredLocks(bool _relock) external;
    function getReward(address _account, bool _stake) external;
    function balanceAtEpochOf(uint256 _epoch, address _user) view external returns(uint256 amount);
    function totalSupplyAtEpoch(uint256 _epoch) view external returns(uint256 supply);
    function epochCount() external view returns(uint256);
    function epochs(uint256 _id) external view returns(uint224,uint32);
    function checkpointEpoch() external;
    function balanceOf(address _account) external view returns(uint256);
    function lockedBalanceOf(address _user) external view returns(uint256 amount);
    function pendingLockOf(address _user) external view returns(uint256 amount);
    function pendingLockAtEpochOf(uint256 _epoch, address _user) view external returns(uint256 amount);
    function totalSupply() view external returns(uint256 supply);
    function lockedBalances(
        address _user
    ) view external returns(
        uint256 total,
        uint256 unlockable,
        uint256 locked,
        LockedBalance[] memory lockData
    );
    function addReward(
        address _rewardsToken,
        address _distributor,
        bool _useBoost
    ) external;
    function approveRewardDistributor(
        address _rewardsToken,
        address _distributor,
        bool _approved
    ) external;
    function setStakeLimits(uint256 _minimum, uint256 _maximum) external;
    function setBoost(uint256 _max, uint256 _rate, address _receivingAddress) external;
    function setKickIncentive(uint256 _rate, uint256 _delay) external;
    function shutdown() external;
    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external;
}