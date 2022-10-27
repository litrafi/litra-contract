pragma solidity ^0.8.0;

import "./ARCB.sol";
import "./VotingEscrow.sol";
import "../interfaces/IDAO.sol";
import "../interfaces/IToken.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract LiquidityGauge is ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;

    event Deposit(address indexed provider, uint256 value);
    event Withdraw(address indexed provider, uint256 value);
    event UpdateLiquidityLimit(
        address user,
        uint256 originalBalance,
        uint256 originalSupply,
        uint256 workingBalance,
        uint256 workingSupply
    );
    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);

    struct Reward {
        address token;
        address distributor;
        uint256 periodFinish;
        uint256 rate;
        uint256 lastUpdate;
        uint256 integral;
    }

    // keccak256("isValidSignature(bytes32,bytes)")[:4] << 224
    bytes32 constant public ERC1271_MAGIC_VAL = 0x1626ba7e00000000000000000000000000000000000000000000000000000000;
    bytes32 constant public EIP712_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 constant public PERMIT_TYPEHASH= keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    string constant public VERSION = "v1.0.0";

    uint256 constant public MAX_REWARDS = 8;
    uint256 constant public TOKENLESS_PRODUCTION = 40;
    uint256 constant public WEEK = 604800;

    address public minter;
    ARCB public immutable ARCB20;
    VotingEscrow public immutable VOTING_ESCROW;
    Controller public immutable GAUGE_CONTROLLER;
    VotingEscrowBoost public immutable VEBOOST_PROXY;

    // string public override name;
    // string public override symbol;
    // uint8 public override decimals = 18;
    // mapping(address => uint256) public override balanceOf;
    // uint256 public override totalSupply;
    // mapping(address => mapping(address => uint256)) public override allowance;

    // bytes32 immutable public DOMAIN_SEPARATOR;
    address immutable public lpToken;

    // mapping(address => uint256) public nonces;
    uint256 public futureEpochTime;

    mapping(address => uint256) public workingBalances;
    uint256 public workingSupply;

    // For tracking external rewards
    address[] public rewardTokens;

    mapping(address => Reward) public rewardData;

    // claimant -> default reward receiver
    mapping(address => address) public rewardsReceiver;
    // reward token -> claiming address -> integral
    mapping(address => mapping(address => uint256)) public rewardIntegralFor;
    // user -> [uint128 claimable amount][uint128 claimed amount]
    mapping(address => mapping(address => uint256)) claimData;

    address public admin;
    address public futureAdmin;
    bool public isKilled;

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from (last_action) till checkpoint
    mapping(address => uint256) public integrateInvSupplyOf;
    mapping(address => uint256) public integrateCheckpointOf;

    // ∫(balance * rate(t) / totalSupply(t) dt) from 0 till checkpoint
    // Units: rate * t = already number of coins per address to issue
    mapping(address => uint256) public integrateFraction;

    uint256 public inflationRate;

    // The goal is to be able to calculate ∫(rate * balance / totalSupply dt) from 0 till checkpoint
    // All values are kept in units of being multiplied by 1e18
    uint256 public period;
    uint256[] public periodTimestamp;

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from 0 till checkpoint
    uint256[] public integrateInvSupply;  // bump epoch when rate() changes

    modifier onlyAdmin() {
        require(msg.sender == admin, "!admin");
        _;
    }

    constructor(
        address _lpToken,
        address _admin,
        address _minter,
        ARCB _arcb,
        VotingEscrow _votingEscrow,
        Controller _gaugeController,
        VotingEscrowBoost _veboostProxy
    ) ReentrancyGuard()
      ERC20Permit(string(abi.encodePacked('ArcheBase.fi', IERC20Metadata(_lpToken).symbol(), " Gauge Deposit")))
      ERC20(
        string(abi.encodePacked('ArcheBase.fi', IERC20Metadata(_lpToken).symbol(), " Gauge Deposit")),
        string(abi.encodePacked(IERC20Metadata(_lpToken).symbol(), '-gauge'))
      )
    {
        lpToken = _lpToken;
        admin = _admin;
        periodTimestamp[0] = block.timestamp;
        minter = _minter;
        ARCB20 = _arcb;
        VOTING_ESCROW = _votingEscrow;
        GAUGE_CONTROLLER = _gaugeController;
        VEBOOST_PROXY = _veboostProxy;
        inflationRate = _arcb.rate();
        futureEpochTime = _arcb.futureEpochTimeWrite();
    }

    function intergrateCheckpoint() external view returns(uint256) {
        return periodTimestamp[uint256(uint128(period))];
    }

    /**
        @notice Calculate limits which depend on the amount of CRV token per-user.
            Effectively it calculates working balances to apply amplification
            of CRV production by CRV
        @param _addr User address
        @param _l User's amount of liquidity (LP tokens)
        @param _L Total amount of liquidity (LP tokens)
     */
    function _updateLiquidityLimit(address _addr, uint256 _l, uint256 _L) internal {
        // To be called after totalSupply is updated
        uint256 votingBalance = VEBOOST_PROXY.adjustedBalanceOf(_addr);
        uint256 votingTotal = VOTING_ESCROW.totalSupply();

        uint256 lim = _l * TOKENLESS_PRODUCTION / 100;
        if(votingTotal > 0) {
            lim += _L * votingBalance / votingTotal * (100 - TOKENLESS_PRODUCTION) / 100;
        }

        lim = Math.min(_l, lim);
        uint256 oldBal = workingBalances[_addr];
        workingBalances[_addr] = lim;
        uint256 _workingSupply = workingSupply + lim - oldBal;
        workingSupply = _workingSupply;

        emit UpdateLiquidityLimit(_addr, _l, _L, lim, _workingSupply);
    }

    /**
        @notice Claim pending rewards and checkpoint rewards for a user
     */
    function _checkpointRewards(address _user, uint256 _totalSupply, bool _claim, address _receiver) internal {
        if(_user != address(0)) {
            if(_claim && _receiver == address(0)) {
                // if receiver is not explicitly declared, check if a default receiver is set
                _receiver = rewardsReceiver[_user];
                if(_receiver == address(0)) {
                    // if no default receiver is set, direct claims to the user
                    _receiver = _user;
                }
            }
        }

        for (uint256 index = 0; index < MAX_REWARDS; index++) {
            if(index == rewardTokens.length) {
                break;
            }
            address token = rewardTokens[index];

            uint256 lastUpdate = Math.min(block.timestamp, rewardData[token].periodFinish);
            uint256 duration = lastUpdate - rewardData[token].lastUpdate;
            if(duration != 0) {
                rewardData[token].lastUpdate = lastUpdate;
                if(_totalSupply != 0) {
                    rewardData[token].integral += duration * rewardData[token].rate * 1e18 / _totalSupply;
                }
            }

            if(_user != address(0)) {
                uint256 integralFor = rewardIntegralFor[token][_user];
                uint256 newClaimable = 0;

                if(integralFor < rewardData[token].integral) {
                    rewardIntegralFor[token][_user] = rewardData[token].integral;
                    newClaimable = balanceOf(_user) * (rewardData[token].integral - integralFor) / 1e18;
                }

                uint256 _claimData = claimData[_user][token];
                uint256 totalClaimable = (_claimData >> 128) + newClaimable;
                if(totalClaimable > 0) {
                    uint256 totalCliamed = _claimData % (2 ** 128);
                    if(_claim) {
                        IERC20(token).safeTransfer(_receiver, totalClaimable);
                        claimData[_user][token] = totalCliamed + totalClaimable;
                    } else if (newClaimable > 0) {
                        claimData[_user][token] = totalCliamed + (totalClaimable << 128);
                    }
                }
            }
        }
    }

    /**
        @notice Checkpoint for a user
        @param _addr User address
     */
    function _checkpoint(address _addr) internal {
        uint256 _period = period;
        uint256 _periodTime = periodTimestamp[_period];
        uint256 _integrateInvSupply = integrateInvSupply[_period];
        uint256 rate = inflationRate;
        uint256 newRate = rate;
        uint256 prevFutureEpoch = futureEpochTime;
        if(prevFutureEpoch >= _periodTime) {
            futureEpochTime = ARCB20.futureEpochTimeWrite();
            newRate = ARCB20.rate();
            inflationRate = newRate;
        }

        if(isKilled) {
            rate = 0;
        }

        // Update integral of 1/supply
        if(block.timestamp > _periodTime) {
            uint256 _workingSupply = workingSupply;
            GAUGE_CONTROLLER.checkpointGauge(_addr);
            uint256 prevWeekTime = _periodTime;
            uint256 weekTime = Math.min((_periodTime + WEEK) / WEEK * WEEK, block.timestamp);

            for (uint256 index = 0; index < 500; index++) {
                uint256 dt = weekTime - prevWeekTime;
                uint256 w = GAUGE_CONTROLLER.gaugeRelativeWeight(address(this), prevWeekTime / WEEK * WEEK);
                
                if(_workingSupply > 0) {
                    if(prevFutureEpoch >= prevWeekTime && prevFutureEpoch < weekTime) {
                        // If we went across one or multiple epochs, apply the rate
                        // of the first epoch until it ends, and then the rate of
                        // the last epoch.
                        // If more than one epoch is crossed - the gauge gets less,
                        // but that'd meen it wasn't called for more than 1 year
                        _integrateInvSupply += rate * w *(prevFutureEpoch - prevWeekTime) / _workingSupply;
                        rate = newRate;
                        _integrateInvSupply += rate * w * (weekTime - prevFutureEpoch) / _workingSupply;
                    } else {
                        _integrateInvSupply += rate * w * dt / _workingSupply;
                    }
                    // On precisions of the calculation
                    // rate ~= 10e18
                    // last_weight > 0.01 * 1e18 = 1e16 (if pool weight is 1%)
                    // _working_supply ~= TVL * 1e18 ~= 1e26 ($100M for example)
                    // The largest loss is at dt = 1
                    // Loss is 1e-9 - acceptable
                }

                if(weekTime == block.timestamp) {
                    break;
                }
                prevWeekTime = weekTime;
                weekTime = Math.min(weekTime + WEEK, block.timestamp);
            }
        }
        _period += 1;
        period = _period;
        periodTimestamp[_period] = block.timestamp;
        integrateInvSupply[_period] = _integrateInvSupply;
        // Update user-specific integrals
        uint256 _workingBalance = workingBalances[_addr];
        integrateFraction[_addr] += _workingBalance * (_integrateInvSupply - integrateInvSupplyOf[_addr]) / 1e18;
        integrateInvSupplyOf[_addr] = _integrateInvSupply;
        integrateCheckpointOf[_addr] = block.timestamp;
    }
    /**
        @notice Record a checkpoint for `addr`
        @param _addr User address
        @return bool success
     */
    function userCheckpoint(address _addr) external returns(bool) {
        require(msg.sender == _addr || msg.sender == minter, "unauthorized");
        _checkpoint(_addr);
        _updateLiquidityLimit(_addr, balanceOf(_addr), totalSupply());
        return true;
    }

    /**
        @notice Get the number of claimable tokens per user
        @dev This function should be manually changed to "view" in the ABI
        @return uint256 number of claimable tokens per user
     */
    function claimableTokens(address _addr) external returns(uint256) {
        _checkpoint(_addr);
        return integrateFraction[_addr] - IMinter(minter).minted(_addr, address(this));
    }

    /**
        @notice Get the number of already-claimed reward tokens for a user
        @param _addr Account to get reward amount for
        @param _token Token to get reward amount for
        @return uint256 Total amount of `_token` already claimed by `_addr`
     */
    function claimedReward(address _addr, address _token) external view returns(uint256) {
        return claimData[_addr][_token] % (2 ** 128);
    }

    /**
        @notice Get the number of claimable reward tokens for a user
        @param _user Account to get reward amount for
        @param _rewardToken Token to get reward amount for
        @return uint256 Claimable reward token amount
     */
    function claimableReward(address _user, address _rewardToken) external view returns(uint256) {
        uint256 integral = rewardData[_rewardToken].integral;
        uint256 _totalSupply = totalSupply();
        if(_totalSupply != 0) {
            uint256 lastUpdate = Math.min(block.timestamp, rewardData[_rewardToken].periodFinish);
            uint256 duration = lastUpdate - rewardData[_rewardToken].lastUpdate;
            integral += (duration * rewardData[_rewardToken].rate * 1e18 / _totalSupply);
        }
        uint256 integralFor = rewardIntegralFor[_rewardToken][_user];
        uint256 newClaimable = balanceOf(_user) * (integral - integralFor) / 1e18;

        return (claimData[_user][_rewardToken] >> 128) + newClaimable;
    }

    /**
        @notice Set the default reward receiver for the caller.
        @dev When set to ZERO_ADDRESS, rewards are sent to the caller
        @param _receiver Receiver address for any rewards claimed via `claim_rewards`
     */
    function setRewardsReceiver(address _receiver) external {
        rewardsReceiver[msg.sender] = _receiver;
    }

    /**
        @notice Claim available reward tokens for `_addr`
        @param _addr Address to claim for
        @param _receiver Address to transfer rewards to - if set to
                        ZERO_ADDRESS, uses the default reward receiver
                        for the caller
     */
    function claimRewards(address _addr, address _receiver) external nonReentrant {
        require(_receiver == address(0) || msg.sender == _addr, "Cannot redirect when claiming for another user");
        _checkpointRewards(_addr, totalSupply(), true, _receiver);
    }

    /**
        @notice Kick `addr` for abusing their boost
        @dev Only if either they had another voting event, or their voting escrow lock expired
        @param _addr Address to kick
     */
    function kick(address _addr) external {
        uint256 tLast = integrateCheckpointOf[_addr];
        uint256 tVe = VOTING_ESCROW.userPointHistoryTs(_addr, VOTING_ESCROW.userPointEpoch(_addr));
        uint256 _balance = balanceOf(_addr);

        require(VOTING_ESCROW.balanceOf(_addr) == 0 || tVe > tLast, "kick not allowed");
        require(workingBalances[_addr] > _balance * TOKENLESS_PRODUCTION / 100, "kick not allowed");

        _checkpoint(_addr);
        _updateLiquidityLimit(_addr, balanceOf(_addr), totalSupply());
    }

    /**
        @notice Deposit `_value` LP tokens
        @dev Depositting also claims pending reward tokens
        @param _value Number of tokens to deposit
        @param _addr Address to deposit for
     */
    function deposit(uint256 _value, address _addr, bool _claimRewards) external nonReentrant {
        _checkpoint(_addr);

        if(_value != 0) {
            bool isRewards = rewardTokens.length != 0;
            if(isRewards) {
                _checkpointRewards(_addr,  totalSupply(), _claimRewards, address(0));
            }
            _mint(_addr, _value);
            _updateLiquidityLimit(_addr, balanceOf(_addr), totalSupply());
            IERC20(lpToken).transferFrom(msg.sender, address(this), _value);
        }

        emit Deposit(_addr, _value);
    }

    /**
        @notice Withdraw `_value` LP tokens
        @dev Withdrawing also claims pending reward tokens
        @param _value Number of tokens to withdraw
     */
    function withdraw(uint256 _value, bool _claimRewards) external nonReentrant {
        _checkpoint(msg.sender);

        if(_value != 0) {
            bool isRewards = rewardTokens.length != 0;
            if(isRewards) {
                _checkpointRewards(msg.sender, totalSupply(), _claimRewards, address(0));
            }

            _burn(msg.sender, _value);
            _updateLiquidityLimit(msg.sender, balanceOf(msg.sender), totalSupply());
            ERC20(lpToken).transfer(msg.sender, _value);
        }

        emit Withdraw(msg.sender, _value);
    }

    function _transfer(address _from, address _to, uint256 _value) internal override {
        _checkpoint(_from);
        _checkpoint(_to);

        if(_value != 0) {
            bool isRewards = rewardTokens.length != 0;
            uint256 _totalSupply = totalSupply();
            if(isRewards) {
                _checkpointRewards(_from, _totalSupply, false, address(0));
                _checkpointRewards(_to, _totalSupply, false, address(0));
            }

            super._transfer(_from, _to, _value);
            _updateLiquidityLimit(_from, balanceOf(_from), _totalSupply);
            _updateLiquidityLimit(_to, balanceOf(_to), _totalSupply);
        }
    }

    /**
        @notice Set the active reward contract
     */
    function addReward(address rewardToken, address _distributor) external onlyAdmin {
        require(rewardTokens.length < MAX_REWARDS, "Too much reward tokens");
        require(rewardData[rewardToken].distributor == address(0), "Already setted");

        rewardData[rewardToken].distributor = _distributor;
        rewardTokens.push(rewardToken);
    }

    function setRewardDistributor(address _rewardToken, address _distributor) external {
        address currentDistributor = rewardData[_rewardToken].distributor;

        require(msg.sender == currentDistributor || msg.sender == admin);
        require(currentDistributor != address(0));
        require(_distributor != address(0));

        rewardData[_rewardToken].distributor = _distributor;
    }

    function depositRewardToken(address _rewardToken, uint256 _amount) external nonReentrant {
        require(msg.sender == rewardData[_rewardToken].distributor, "!distributor");
        
        _checkpointRewards(address(0), totalSupply(), false, address(0));
        
        IERC20(_rewardToken).safeTransferFrom(msg.sender, address(this), _amount);
        
        uint256 periodFinish = rewardData[_rewardToken].periodFinish;
        if(block.timestamp >= periodFinish) {
            rewardData[_rewardToken].rate = _amount / WEEK;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardData[_rewardToken].rate;
            rewardData[_rewardToken].rate = (_amount + leftover) / WEEK;
        }

        rewardData[_rewardToken].lastUpdate = block.timestamp;
        rewardData[_rewardToken].periodFinish = block.timestamp + WEEK;
    }

    function setKilled(bool _isKiiled) external onlyAdmin {
        isKilled = _isKiiled;
    }

    function commitTransferOwnership(address _addr) external {
        futureAdmin = _addr;
        emit CommitOwnership(_addr);
    }

    function acceptTransferOwnership() external {
        address _admin = futureAdmin;
        require(msg.sender == _admin, "!admin");
        admin = _admin;

        emit ApplyOwnership(_admin);
    }


}