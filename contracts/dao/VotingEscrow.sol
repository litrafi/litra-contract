pragma solidity ^0.8.0;

import "../interfaces/IDAO.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VotingEscrow is ReentrancyGuard {
    struct Point {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
    }

    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    enum OperationType {
        DEPOSIT_FOR,
        CREATE_LOCK,
        INCREASE_LOCK_AMOUNT,
        INCREASE_UNLOCK_TIME
    }

    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);
    event Deposit(
        address indexed provider,
        uint256 value,
        uint256 locktime,
        OperationType operationType
    );
    event Withdraw(address indexed provider, uint256 value);
    event Supply(uint256 prevSupply, uint256 supply);
    // all future times are rounded by week
    uint256 constant private WEEK = 7 * 86400;
    // 4 years
    int128 constant private MAXTIME = 4 * 365 * 86400;
    uint256 constant private MULTIPLIER = 10 ** 18;

    address public token;
    uint256 public supply;
    mapping(address => LockedBalance) public locked;

    uint256 public epoch;
    // epoch -> unsigned point
    Point[] public pointHistory;
    // user -> epoch -> unsigned point
    mapping(address => mapping(uint256 => Point)) public userPointHistory;
    mapping(address => uint256) public userPointEpoch;
    // time -> signed slope change
    mapping(uint256 => int128) public slopeChanges;

    // Aragon's view methods for compatibility
    address public controller;
    bool public transfersEnabled;
    string public name;
    string public symbol;
    string public version;
    uint256 public decimals;

    // Checker for whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    address public futureSmartWalletChecker;
    address public smartWalletChecker;
    address public admin;
    address public futureAdmin;

    modifier onlyAdmin {
        require(msg.sender == admin, '!admin');
        _;
    }

    modifier onlyEOA {
        bool allowed = false;
        if(msg.sender != tx.origin) {
            if(smartWalletChecker != address(0)) {
                allowed = SmartWalletChecker(smartWalletChecker).check(msg.sender);
            }
        } else {
            allowed = true;
        }
        require(allowed, "Smart contract depositors not allowed");
        _;
    }

    constructor(
        address _token,
        string memory _name,
        string memory _symbol,
        string memory _version
    ) ReentrancyGuard() {
        admin = msg.sender;
        token = _token;
        pointHistory.push(Point({
            blk: block.timestamp,
            ts: block.timestamp,
            bias: 0,
            slope: 0
        }));
        controller = msg.sender;
        transfersEnabled = true;
        decimals = ERC20(_token).decimals();
        name = _name;
        symbol = _symbol;
        version = _version;
    }

    function commitTransferOwnership(address addr) external onlyAdmin {
        futureAdmin = addr;
        emit CommitOwnership(addr);
    }

    function applyTransferOwnership() external onlyAdmin {
        admin = futureAdmin;
        emit ApplyOwnership(futureAdmin);
    }

    function commitSmartWalletChecker(address addr) external onlyAdmin {
        futureSmartWalletChecker = addr;
    }

    function applySmartWalletChecker() external onlyAdmin {
        smartWalletChecker = futureSmartWalletChecker;
    }

    function getLastUserSlope(address addr) external view returns(int128) {
        uint256 uEpoch = userPointEpoch[addr];
        return userPointHistory[addr][uEpoch].slope;
    }

    function userPointHistoryTs(address addr, uint256 id) external view returns(uint256) {
        return userPointHistory[addr][id].ts;
    }

    function lockedEnd(address addr) external view returns(uint256) {
        return locked[addr].end;
    }

    function _checkpoint(address addr, LockedBalance memory oldLocked, LockedBalance memory newLocked) internal {
        Point memory uOld = Point(0, 0, 0, 0);
        Point memory uNew = Point(0, 0, 0, 0);
        int128 oldDSlope = 0;
        int128 newDSlope = 0;

        if(addr != address(0)) {
            // Calculate slopes and biases
            if(oldLocked.end > block.timestamp && oldLocked.amount > 0) {
                uOld.slope = oldLocked.amount / MAXTIME;
                uOld.bias = uOld.slope * int128(uint128(oldLocked.end - block.timestamp));
            }
            if(newLocked.end > block.timestamp && newLocked.amount > 0){
                uNew.slope = newLocked.amount / MAXTIME;
                uNew.bias = uNew.slope * int128(uint128(newLocked.end - block.timestamp));
            }
            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            oldDSlope = slopeChanges[oldLocked.end];
            if(newLocked.end != 0) {
                if(newLocked.end == oldLocked.end) {
                    newDSlope = oldDSlope;
                } else {
                    newDSlope = slopeChanges[newLocked.end];
                }
            }
        }

        Point memory lastPoint = Point( 0, 0, block.timestamp, block.timestamp);
        if(epoch > 0) {
            lastPoint = pointHistory[epoch];
        }
        uint256 lastCheckpoint = lastPoint.ts;
        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initialLastPoint = lastPoint;
        uint256 blockSlope = 0;
        if(block.timestamp > lastPoint.ts) {
            blockSlope = MULTIPLIER * (block.number - lastPoint.blk) / (block.timestamp - lastPoint.ts);
        }
        // Go over weeks to fill history and calculate what the current point is
        uint256 ti = (lastCheckpoint / WEEK) * WEEK;
        for (uint8 index = 0; index < 255; index++) {
            ti += WEEK;
            int128 dSlope = 0;
            if(ti > block.timestamp) {
                ti = block.timestamp;
            } else {
                dSlope = slopeChanges[ti];
            }
            lastPoint.bias -= lastPoint.slope * int128(uint128(ti - lastCheckpoint));
            lastPoint.slope += dSlope;
            if(lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
            if(lastPoint.slope < 0) {
                lastPoint.slope = 0;
            }
            lastCheckpoint = ti;
            lastPoint.ts = ti;
            lastPoint.blk = initialLastPoint.blk + blockSlope * (ti - initialLastPoint.ts) / MULTIPLIER;
            epoch += 1;
            if(ti == block.timestamp) {
                lastPoint.blk = block.number;
                break;
            } else {
                pointHistory[epoch] = lastPoint;
            }
        }
        // Now point_history is filled until t=now
        if(addr != address(0)) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            lastPoint.slope += uNew.slope - uOld.slope;
            lastPoint.bias += uNew.bias - uOld.slope;
            if(lastPoint.slope < 0) {
                lastPoint.slope = 0;
            }
            if(lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
        }
        // Record the changed point into history
        pointHistory[epoch] = lastPoint;
        if(addr != address(0)) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if(oldLocked.end > block.timestamp) {
                oldDSlope += uOld.slope;
                if(newLocked.end == oldLocked.end) {
                    oldDSlope -= uNew.slope;
                }
                slopeChanges[oldLocked.end] = oldDSlope;
            }

            if(newLocked.end > block.timestamp) {
                if(newLocked.end > oldLocked.end) {
                    newDSlope -= uNew.slope;
                    slopeChanges[newLocked.end] = newDSlope;
                }
            }

            uint256 userEpoch = userPointEpoch[addr] + 1;
            userPointEpoch[addr] = userEpoch;
            uNew.ts = block.timestamp;
            uNew.blk = block.number;
            userPointHistory[addr][userEpoch] = uNew;
        }
    }

    /**
        @notice Deposit and lock tokens for a user
        @param _addr User's wallet address
        @param _value Amount to deposit
        @param unlockTime New time when to unlock the tokens, or 0 if unchanged
        @param lockedBalance Previous locked amount / timestamp
     */
    function _depositFor(
        address _addr,
        uint256 _value,
        uint256 unlockTime,
        LockedBalance memory lockedBalance,
        OperationType operationType
    ) internal {
        uint256 supplyBefore = supply;

        supply = supplyBefore + _value;
        LockedBalance memory oldLocked = lockedBalance;
        lockedBalance.amount += int128(uint128(_value));
        if(unlockTime != 0) {
            lockedBalance.end = unlockTime;
        }
        locked[_addr] = lockedBalance;

        _checkpoint(_addr, oldLocked, lockedBalance);

        if(_value != 0) {
            ERC20(token).transferFrom(_addr, address(this), _value);
        }

        emit Deposit(_addr, _value, lockedBalance.end, operationType);
        emit Supply(supplyBefore, supply);
    }

    function checkpoint() external {
        _checkpoint(address(0), LockedBalance(0, 0), LockedBalance(0, 0));
    }

    function depositFor(address _addr, uint256 _value) external nonReentrant {
        LockedBalance memory lockedBalance = locked[_addr];

        require(_value > 0, "Non-zero value");
        require(lockedBalance.amount > 0, "No existing lock found");
        require(lockedBalance.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _depositFor(_addr, _value, 0, lockedBalance, OperationType.DEPOSIT_FOR);
    }

    function createLock(uint256 _value, uint256 _unlockTime) external nonReentrant onlyEOA {
        uint256 unlockTime = _unlockTime / WEEK * WEEK;
        LockedBalance memory lockedBalance = locked[msg.sender];

        require(_value > 0, "Non-zero value");
        require(lockedBalance.amount == 0, "Withdraw old tokens first");
        require(unlockTime > block.timestamp, "Can only lock until time in the future");
        require(unlockTime <= block.timestamp + uint256(int256(MAXTIME)), "Voting lock can be 4 years max");

        _depositFor(msg.sender, _value, unlockTime, lockedBalance, OperationType.CREATE_LOCK);
    }

    function increaseAmount(uint256 _value) external nonReentrant onlyEOA {
        LockedBalance memory lockedBalance = locked[msg.sender];

        require(_value > 0, "Non-zero value");
        require(lockedBalance.amount > 0, "No existing lock found");
        require(lockedBalance.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _depositFor(msg.sender, _value, 0, lockedBalance, OperationType.INCREASE_LOCK_AMOUNT);
    }

    function increaseUnlockTime(uint256 _unlockTime) external nonReentrant onlyEOA {
        LockedBalance memory lockedBalance = locked[msg.sender];
        _unlockTime = _unlockTime / WEEK * WEEK;

        require(lockedBalance.end > block.timestamp, "Lock expired");
        require(lockedBalance.amount > 0, "Nothing is locked");
        require(_unlockTime > lockedBalance.end, "Can only increase lock duration");
        require(_unlockTime <= block.timestamp + uint256(int256(MAXTIME)), "Voting lock can be 4 years max");

        _depositFor(msg.sender, 0, _unlockTime, lockedBalance, OperationType.INCREASE_UNLOCK_TIME);
    }

    function withdraw() external nonReentrant onlyEOA {
        LockedBalance memory lockedBalance = locked[msg.sender];
        require(block.timestamp >= lockedBalance.end, "The lock didn't expire");
        uint256 value = uint256(int256(lockedBalance.amount));

        LockedBalance memory oldLocked = lockedBalance;
        lockedBalance.amount = 0;
        lockedBalance.end = 0;
        locked[msg.sender] = lockedBalance;
        uint256 supplyBefore = supply;
        supply -= value;

        _checkpoint(msg.sender, oldLocked, lockedBalance);

        ERC20(token).transfer(msg.sender, value);

        emit Withdraw(msg.sender, value);
        emit Supply(supplyBefore, supplyBefore - value);
    }

    function _findBlockEpoch(uint256 _block, uint256 maxEpoch) internal view returns(uint256){
        uint256 min = 0;
        uint256 max = maxEpoch;
        
        for (uint8 i = 0; i < 128; i++) {
            if(min >= max) {
                break;
            }
            uint256 mid = (max + min) / 2;
            if(pointHistory[mid].blk <= _block) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        return min;
    }

    function balanceOf(address _addr, uint256 _t) public view returns(uint256) {
        uint256 _epoch = userPointEpoch[_addr];
        if(_epoch == 0){
            return 0;
        } else {
            Point memory lastPoint = userPointHistory[_addr][_epoch];
            lastPoint.bias -= lastPoint.slope * int128(uint128(_t - lastPoint.ts));
            if(lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
            return uint256(uint128(lastPoint.bias));
        }
    }

    function balanceOf(address _addr) external view returns(uint256) {
        return balanceOf(_addr, block.timestamp);
    }

    function balanceOfAt(address _addr, uint256 _block) external view returns(uint256) {
        require(_block < block.number, "Invalid block number");
        // find point
        uint256 min = 0;
        uint256 max = userPointEpoch[_addr];
        for (uint8 i = 0; i < 128; i++) {
            if(min >= max) {
                break;
            }
            uint256 mid = (max + min) / 2;
            if(userPointHistory[_addr][mid].blk <= _block) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        Point memory uPoint = userPointHistory[_addr][min];
        // Extrapolate block timestamp
        uint256 maxEpoch = epoch;
        uint256 _epoch = _findBlockEpoch(_block, maxEpoch);
        Point memory point0 = pointHistory[_epoch];
        uint256 dBlock = 0;
        uint256 dT = 0;
        if(_epoch < maxEpoch) {
            Point memory point1 = pointHistory[_epoch + 1];
            dBlock = point1.blk - point0.blk;
            dT = point1.ts - point0.ts;
        } else {
            dBlock = block.number - point0.blk;
            dT = block.timestamp - point0.ts;
        }
        uint256 blockTime = point0.ts;
        if(dBlock != 0) {
            blockTime += dT * (_block - point0.blk) / dBlock;
        }
        // Calcualte balance
        uPoint.bias = uPoint.slope * int128(uint128(blockTime - uPoint.ts));
        if(uPoint.bias > 0){
            return uint256(uint128(uPoint.bias));
        } else {
            return 0;
        }
    }

    function _supplyAt(Point memory _lastPoint, uint256 _t) internal view returns(uint256) {
        uint256 ti = _lastPoint.ts / WEEK * WEEK;
        for (uint8 index = 0; index < 255; index++) {
           ti += WEEK;
           int128 dSlope = 0;
            if(ti > _t) {
                ti = _t;
            } else {
                dSlope = slopeChanges[ti];
            }
            _lastPoint.bias = _lastPoint.slope * int128(uint128(ti - _lastPoint.ts));
            if(ti == _t) {
                break;
            }
            _lastPoint.slope += dSlope;
            _lastPoint.ts = ti;
        }

        if(_lastPoint.bias < 0){
            _lastPoint.bias = 0;
        }
        return uint256(uint128(_lastPoint.bias)); 
    }

    function totalSupply(uint256 _t) public view returns(uint256) {
        return _supplyAt(pointHistory[epoch], _t);
    }

    function totalSupply() external view returns(uint256) {
        return totalSupply(block.timestamp);
    }

    function totalSupplyAt(uint256 _block) external view returns(uint256) {
        require(_block <= block.number, "Invalid block");
        uint256 _epoch = epoch;
        uint256 targetEpoch = _findBlockEpoch(_block, _epoch);
        Point memory point = pointHistory[targetEpoch];

        uint256 dt = 0;
        if(targetEpoch < _epoch) {
            Point memory nextPoint = pointHistory[targetEpoch + 1];
            if(point.blk != nextPoint.blk) {
                dt = (_block - point.blk) * (nextPoint.ts - point.ts) / (nextPoint.blk - point.blk);
            }
        } else if(point.blk != block.number) {
            dt = (_block - point.blk) * (block.timestamp - point.ts) / (block.number - point.blk);
        }

        return _supplyAt(point, point.ts + dt);
    }

    function changeController(address _newController) external {
        require(msg.sender == controller, "!controller");
        controller = _newController;
    }
}