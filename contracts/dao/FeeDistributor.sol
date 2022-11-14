pragma solidity ^0.8.0;

import "./VotingEscrow.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";

contract FeeDistributor is ReentrancyGuard {
    event CommitAdmin(address admin);
    event ApplyAdmin(address admin);
    event ToggleAllowCheckpointToken(bool toggleFlag);
    event CheckpointToken(uint256 time, uint256 tokens);
    event Claimed(address indexed recipient, uint256 amount, uint256 claimEpoch, uint256 maxEpoch);

    struct Point {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
    }

    uint256 constant private TOKEN_CHECKPOINT_DEADLINE = 86400;

    uint256 public startTime;
    uint256 public timeCursor;
    mapping(address => uint256) public timeCursorOf;
    mapping(address => uint256) public userEpochOf;

    uint256 public lastTokenTime;
    uint256[] public tokensPerWeek;

    VotingEscrow public votingEscrow;
    IERC20 public token;
    uint256 public totalReceived;
    uint256 public tokenLastBalance;
    // VE total supply at week bounds
    uint256[] public veSupply;

    address public admin;
    address public futureAdmin;
    bool public canCheckpointToken;
    address public emergencyReturn;
    bool public isKiiled;

    modifier notKilled() {
        require(!isKiiled, "killed");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "!admin");
        _;
    }

    /**
        @notice Contract constructor
        @param _votingEscow VotingEscrow contract address
        @param _startTime Epoch time for fee distribution to start
        @param _token Fee token address (3CRV)
        @param _admin Admin address
        @param _emergencyReturn Address to transfer `_token` balance to
                                if this contract is killed
     */
    constructor(
        VotingEscrow _votingEscow,
        uint256 _startTime,
        IERC20 _token,
        address _admin,
        address _emergencyReturn
    ) {
        _startTime = _startTime / 1 weeks * 1 weeks;
        votingEscrow = _votingEscow;
        startTime = _startTime;
        token = _token;
        admin = _admin;
        emergencyReturn = _emergencyReturn;
    }

    function _checkpointToken() internal {
        uint256 tokenBalance = token.balanceOf(address(this));
        uint256 toDistribute = tokenBalance - tokenLastBalance;
        tokenLastBalance = tokenBalance;

        uint256 t = lastTokenTime;
        uint256 sinceLast = block.timestamp - t;
        lastTokenTime = block.timestamp;
        uint256 thisWeek = t / 1 weeks * 1 weeks;
        uint256 nextWeek = 0;

        for (uint256 index = 0; index < 20; index++) {
            nextWeek = thisWeek + 1 weeks;
            if(block.timestamp < nextWeek) {
                if(sinceLast == 0 && block.timestamp == t) {
                    tokensPerWeek[thisWeek] += toDistribute;
                } else {
                    tokensPerWeek[thisWeek] += toDistribute * (block.timestamp - t) / sinceLast;
                }
                break;
            } else {
                if(sinceLast == 0 && nextWeek == t) {
                    tokensPerWeek[thisWeek] += toDistribute;
                } else {
                    tokensPerWeek[thisWeek] += toDistribute * (nextWeek - t) / sinceLast;
                }
            }

            t = nextWeek;
            thisWeek = nextWeek;
        }

        emit CheckpointToken(block.timestamp, toDistribute);
    }

    /**
        @notice Update the token checkpoint
        @dev Calculates the total number of tokens to be distributed in a given week.
            During setup for the initial distribution this function is only callable
            by the contract owner. Beyond initial distro, it can be enabled for anyone
            to call.
     */
    function checkpointToken() external {
        require(
            msg.sender == admin || (canCheckpointToken && block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE),
            "Not allowed"
        );
        _checkpointToken();
    }

    function _findTimestampEpoch(uint256 _timestamp) internal view returns(uint256) {
        uint256 _min = 0;
        uint256 _max = votingEscrow.epoch();
        for (uint256 index = 0; index < 128; index++) {
            if(_min > _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            (,, uint256 ts,) = votingEscrow.pointHistory(_mid);
            if(ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function _findTimestampUserEpoch(address _user, uint256 _timestamp, uint256 maxUserEpoch) internal view returns(uint256) {
        uint256 _min = 0;
        uint256 _max = maxUserEpoch;

        for (uint256 index = 0; index < 128; index++) {
            if(_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            (,,uint256 ts,) = votingEscrow.userPointHistory(_user, _mid);
            if(ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /**
        @notice Get the veCRV balance for `_user` at `_timestamp`
        @param _user Address to query balance for
        @param _timestamp Epoch time
        @return uint256 veCRV balance
     */
    function veForAt(address _user, uint256 _timestamp) external view returns(uint256) {
        uint256 maxUserEpoch = votingEscrow.userPointEpoch(_user);
        uint256 epoch = _findTimestampUserEpoch(_user, _timestamp, maxUserEpoch);
        (int128 bias, int128 slope, uint256 ts,) = votingEscrow.userPointHistory(_user, epoch);
        return uint256(SignedMath.max(bias - slope * int128(uint128(_timestamp - ts)), 0));
    }

    function _checkpointTotalSupply() internal {
        VotingEscrow ve = votingEscrow;
        uint256 t = timeCursor;
        uint256 roundedTimestamp = block.timestamp / 1 weeks * 1 weeks;
        ve.checkpoint();

        for (uint256 index = 0; index < 20; index++) {
            if(t > roundedTimestamp) {
                break;
            } else {
                uint256 epoch = _findTimestampEpoch(t);
                (int128 bias, int128 slope, uint256 ts,) = ve.pointHistory(epoch);
                uint256 dt = 0;
                if(t > ts) {
                    // If the point is at 0 epoch, it can actually be earlier than the first deposit
                    // Then make dt 0
                    dt = t - ts;
                }
                veSupply[t] = uint256(SignedMath.max(bias, slope * int256(dt)));
            }
            t += 1 weeks;
        }
        timeCursor = t;
    }

    /**
        @notice Update the veCRV total supply checkpoint
        @dev The checkpoint is also updated by the first claimant each
            new epoch week. This function may be called independently
            of a claim, to reduce claiming gas costs.
     */
    function checkpointTotalSupply() external {
        _checkpointTotalSupply();
    }

    function _claim(address _addr, uint256 _lastTokenTime) internal returns(uint256) {
        // Minimal user_epoch is 0 (if user had no point)
        uint256 userEpoch = 0;
        uint256 toDistribute = 0;

        uint256 maxUserEpoch = votingEscrow.userPointEpoch(_addr);
        uint256 _startTime = startTime;

        if(maxUserEpoch == 0) {
            // No lock = no fees
            return 0;
        }

        uint256 weekCursor = timeCursorOf[_addr];
        if(weekCursor == 0) {
            // Need to do the initial binary search
            userEpoch = _findTimestampUserEpoch(_addr, _startTime, maxUserEpoch);
        } else {
            userEpoch = userEpochOf[_addr];
        }

        if(userEpoch == 0) {
            userEpoch = 1;
        }

        (int128 bias, int128 slope, uint256 ts, uint256 blk) = votingEscrow.userPointHistory(_addr, userEpoch);

        if(weekCursor == 0) {
            weekCursor = (ts + 1 weeks - 1) / 1 weeks * 1 weeks;
        }

        if(weekCursor >= _lastTokenTime) {
            return 0;
        }

        if(weekCursor < _startTime) {
            weekCursor = _startTime;
        }

        Point memory oldUserPoint = Point(0, 0, 0, 0);

        // Iterate over weeks
        for (uint256 index = 0; index < 50; index++) {
            if(weekCursor >= _lastTokenTime) {
                break;
            }

            if(weekCursor >= ts && userEpoch <= maxUserEpoch) {
                userEpoch += 1;
                oldUserPoint = Point(bias, slope, ts, blk);
                if(userEpoch > maxUserEpoch) {
                    bias = 0;
                    slope = 0;
                    ts = 0;
                    blk = 0;
                } else {
                    (bias, slope, ts, blk) = votingEscrow.userPointHistory(_addr, userEpoch);
                }
            } else {
                // Calc
                // + i * 2 is for rounding errors
                int128 dt = int128(int256(weekCursor - oldUserPoint.ts));
                uint256 balanceOf = uint256(SignedMath.max(oldUserPoint.bias - dt * oldUserPoint.slope, 0));
                if(balanceOf == 0 && userEpoch > maxUserEpoch) {
                    break;
                }
                if(balanceOf > 0) {
                    toDistribute += balanceOf * tokensPerWeek[weekCursor] / veSupply[weekCursor];
                }
            }
        }

        userEpoch = Math.min(maxUserEpoch, userEpoch - 1);
        userEpochOf[_addr] = userEpoch;
        timeCursorOf[_addr] = weekCursor;

        emit Claimed(_addr, toDistribute, userEpoch, maxUserEpoch);

        return toDistribute;
    }

    /**
        @notice Claim fees for `_addr`
        @dev Each call to claim look at a maximum of 50 user veCRV points.
            For accounts with many veCRV related actions, this function
            may need to be called more than once to claim all available
            fees. In the `Claimed` event that fires, if `claim_epoch` is
            less than `max_epoch`, the account may claim again.
        @param _addr Address to claim fees for
        @return uint256 Amount of fees claimed in the call
     */
    function claim(address _addr) external nonReentrant notKilled returns(uint256) {
        if(block.timestamp >= timeCursor) {
            _checkpointTotalSupply();
        }

        uint256 _lastTokenTime = lastTokenTime;

        if(canCheckpointToken && (block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpointToken();
            lastTokenTime = block.timestamp;
        }

        lastTokenTime = lastTokenTime / 1 weeks * 1 weeks;

        uint256 amount = _claim(_addr, _lastTokenTime);
        if(amount != 0) {
            tokenLastBalance -= amount;
            token.transfer(_addr, amount);
        }

        return amount;
    }

    /**
        @notice Make multiple fee claims in a single call
        @dev Used to claim for many accounts at once, or to make
            multiple claims for the same address when that address
            has significant veCRV history
        @param _receivers List of addresses to claim for. Claiming
                        terminates at the first `ZERO_ADDRESS`.
        @return bool success
     */
    function claimManny(address[] calldata _receivers) external nonReentrant notKilled returns(bool) {
        if(block.timestamp >= timeCursor) {
            _checkpointTotalSupply();
        }

        uint256 _lastTokenTime = lastTokenTime;

        if(canCheckpointToken && block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        _lastTokenTime = _lastTokenTime / 1 weeks * 1 weeks;
        IERC20 _token = token;
        uint256 total = 0;

        for (uint256 index = 0; index < _receivers.length; index++) {
            address addr = _receivers[index];

            uint256 amount = _claim(addr, _lastTokenTime);
            if(amount != 0) {
                _token.transfer(addr, amount);
                total += amount;
            }
        }

        if(total != 0) {
            tokenLastBalance -= total;
        }

        return true;
    }

    /**
        @notice Receive 3CRV into the contract and trigger a token checkpoint
        @return bool success
     */
    function burn() external notKilled returns(bool) {
        IERC20 _token = token;

        uint256 amount = _token.balanceOf(msg.sender);
        if(amount != 0) {
            _token.transferFrom(msg.sender, address(this), amount);
            if(canCheckpointToken && block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE) {
                _checkpointToken();
            }
        }

        return true;
    }

    function commitAdmin(address _addr) external onlyAdmin {
        futureAdmin = _addr;
        emit CommitAdmin(_addr);
    }

    function applyAdmin() external {
        require(futureAdmin != address(0), "Future admin is not set");
        admin = futureAdmin;
        emit ApplyAdmin(futureAdmin);
    }

    function toggleAllowCheckpointToken() external onlyAdmin {
        bool flag = !canCheckpointToken;
        canCheckpointToken = flag;
        emit ToggleAllowCheckpointToken(flag);
    }

    function killMe() external onlyAdmin {
        isKiiled = true;
        IERC20 _token = token;
        _token.transfer(emergencyReturn, _token.balanceOf(address(this)));
    }

    /**
        @notice Recover ERC20 tokens from this contract
        @dev Tokens are sent to the emergency return address.
        @return bool success
     */
    function recoverBalance() external onlyAdmin returns(bool) {
        IERC20 _token = token;

        uint256 amount = _token.balanceOf(address(this));
        _token.transfer(emergencyReturn, amount);

        return true;
    }
}