pragma solidity ^0.8.0;

import "./LA.sol";
import "./VotingEscrow.sol";
import "../interfaces/IDAO.sol";
import "./admin/OwnershipAdminManaged.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

contract GaugeController is OwnershipAdminManaged {
    event AddType(string name, uint256 typeId);
    event NewTypeWeight(uint256 typeId, uint256 time, uint256 weight, uint256 totalWeight);
    event NewGaugeWeight(address gaugeAddress, uint256 weight, uint256 totalWeight);
    event VoteForGauge(address user, address gaugeAddr, uint256 weight);
    event NewGauge(address addr, uint256 gaugeType, uint256 weight);

    struct Point {
        uint256 bias;
        uint256 slope;
    }

    struct VotedSlope {
        uint256 slope;
        uint256 power;
        uint256 end;
    }

    uint256 constant public WEIGHT_VOTE_DELAY = 10 days;
    uint256 constant public MULTIPLIER = 1e18;

    address public futureAdmin;

    LA public token; // LA token
    VotingEscrow public votingEscrow;

    // Gauge parameters
    // All numbers are "fixed point" on the basis of 1e18
    uint256 public nGaugeTypes;
    mapping(uint256 => string) public gaugeTypeNames;

    // Needed for enumeration
    address[] public gauges;

    //  we increment values by 1 prior to storing them here so we can rely on a value
    //  of zero as meaning the gauge has not been set
    mapping(address => uint256) private gaugeTypes_;
    // user -> gauge_addr -> VotedSlope
    mapping(address => mapping(address => VotedSlope)) public voteUserSlopes;
    // Total vote power used by user
    mapping(address => uint256) public voteUserPower;
    // Last user vote's timestamp for each gauge address
    mapping(address => mapping(address => uint256)) public lastUserVote;

    // Past and scheduled points for gauge weight, sum of weights per type, total weight
    // Point is for bias+slope
    // changes_* are for changes in slope
    // time_* are for the last change timestamp
    // timestamps are rounded to whole weeks

    // gauge_addr -> time -> Point
    mapping(address => mapping(uint256 => Point)) public pointsWeight;
    // gauge_addr -> time -> slope
    mapping(address => mapping(uint256 => uint256)) private changesWeight;
    // last scheduled time (next week)
    mapping(address => uint256) public timeWeight;

    // type_id -> time -> Point
    mapping(uint256 => mapping(uint256 => Point)) public pointsSum;
    // type_id -> time -> slope
    mapping(uint256 => mapping(uint256 => uint256)) private changesSum;
    // type_id -> last scheduled time (next week)
    mapping(uint256 => uint256) public timeSum;

    // time -> total weight
    mapping(uint256 => uint256) public pointsTotal;
    // last scheduled time
    uint256 public timeTotal;

    // type_id -> time -> type weight
    mapping(uint256 => mapping(uint256 => uint256)) public pointsTypeWeight;
    // type_id -> last scheduled time (next week)
    mapping(uint256 => uint256) public timeTypeWeight;

    constructor(address _token, address _votingEscrow) OwnershipAdminManaged(msg.sender) {
        require(_token != address(0), "Invalid token");
        require(_votingEscrow != address(0), "Invalid ve");

        token = LA(_token);
        votingEscrow = VotingEscrow(_votingEscrow);
        timeTotal = block.timestamp / 1 weeks * 1 weeks;
    }

    function gaugeTypes(address _addr) public view returns(uint256) {
        uint256 gaugeType = gaugeTypes_[_addr];
        require(gaugeType != 0, "Invalid gauge");

        return gaugeType - 1;
    }

    /**
        @notice Fill historic type weights week-over-week for missed checkins
            and return the type weight for the future week
        @param _gaugeType Gauge type id
        @return Type weight
     */
    function _getTypeWeight(uint256 _gaugeType) internal returns(uint256) {
        uint256 t = timeTypeWeight[_gaugeType];
        if(t > 0) {
            uint256 w = pointsTypeWeight[_gaugeType][t];
            for (uint256 index = 0; index < 500; index++) {
                if(t > block.timestamp) {
                    break;
                }
                t += 1 weeks;
                pointsTypeWeight[_gaugeType][t] = w;
                if(t > block.timestamp) {
                    timeTypeWeight[_gaugeType] = t;
                }
            }
            return w;
        } else {
            return 0;
        }
    }
    /**
        @notice Fill sum of gauge weights for the same type week-over-week for
            missed checkins and return the sum for the future week
        @param _gaugeType Gauge type id
        @return Sum of weights
     */
    function _getSum(uint256 _gaugeType) internal returns(uint256) {
        uint256 t = timeSum[_gaugeType];
        if(t > 0) {
            Point memory pt = pointsSum[_gaugeType][t];
            for (uint256 index = 0; index < 500; index++) {
                if(t > block.timestamp) {
                    break;
                }
                t += 1 weeks;
                uint256 dBias = pt.slope * 1 weeks;
                if(pt.bias > dBias) {
                    pt.bias -= dBias;
                    pt.slope -= changesSum[_gaugeType][t];
                } else {
                    pt.bias = 0;
                    pt.slope = 0;
                }

                pointsSum[_gaugeType][t] = pt;
                if(t > block.timestamp) {
                    timeSum[_gaugeType] = t;
                }
            }
            return pt.bias;
        } else {
            return 0;
        }
    }

    /**
        @notice Fill historic total weights week-over-week for missed checkins
            and return the total for the future week
        @return Total weight
     */
    function _getTotal() internal returns(uint256) {
        uint256 t = timeTotal;
        uint256 _nGaugeTypes = nGaugeTypes;
        if(t > block.timestamp) {
            // If we have already checkpointed - still need to change the value
            t -= 1 weeks;
        }
        uint256 pt = pointsTotal[t];

        for (uint256 _gaugeType = 0; _gaugeType < _nGaugeTypes; _gaugeType++) {
            _getSum(_gaugeType);
            _getTypeWeight(_gaugeType);
        }

        for (uint256 index = 0; index < 500; index++) {
            if(t > block.timestamp) {
                break;
            }
            t += 1 weeks;
            pt = 0;
            // Scales as n_types * n_unchecked_weeks (hopefully 1 at most)
            for (uint256 _gaugeType = 0; _gaugeType < _nGaugeTypes; _gaugeType++) {
                uint256 typeSum = pointsSum[_gaugeType][t].bias;
                uint256 typeWeight = pointsTypeWeight[_gaugeType][t];
                pt += typeSum * typeWeight;
            }
            pointsTotal[t] = pt;

            if(t > block.timestamp) {
                timeTotal = t;
            }
        }
        return pt;
    }

    /**
        @notice Fill historic gauge weights week-over-week for missed checkins
            and return the total for the future week
        @param _gaugeAddr Address of the gauge
        @return Gauge weight
     */
    function _getWeight(address _gaugeAddr) internal returns(uint256) {
        uint256 t = timeWeight[_gaugeAddr];
        if(t > 0) {
            Point memory pt = pointsWeight[_gaugeAddr][t];
            for (uint256 index = 0; index < 500; index++) {
                if(t > block.timestamp) {
                    break;
                }
                t += 1 weeks;
                uint256 dBias = pt.slope * 1 weeks;
                if(pt.bias > dBias) {
                    pt.bias -= dBias;
                    pt.slope -= changesWeight[_gaugeAddr][t];
                } else {
                    pt.bias = 0;
                    pt.slope = 0;
                }
                pointsWeight[_gaugeAddr][t] = pt;
                if(t > block.timestamp) {
                    timeWeight[_gaugeAddr] = t;
                }
            }
            return pt.bias;
        } else {
            return 0;
        }
    }

    /**
        @notice Add gauge `addr` of type `gauge_type` with weight `weight`
        @param _addr Gauge address
        @param _gaugeType Gauge type
        @param _weight Gauge weight
     */
    function addGauge(address _addr, uint256 _gaugeType, uint256 _weight) external onlyOwnershipAdmin {
        require(_gaugeType < nGaugeTypes, "Invalid gauge type");
        require(gaugeTypes_[_addr] == 0, "Cannot add the same gauge twice");

        gauges.push(_addr);
        gaugeTypes_[_addr] = _gaugeType + 1;
        uint256 nextTime = (block.timestamp + 1 weeks) / 1 weeks * 1 weeks;

        if(_weight > 0) {
            uint256 _typeWeight = _getTypeWeight(_gaugeType);
            uint256 _oldSum = _getSum(_gaugeType);
            uint256 _oldTotal = _getTotal();

            pointsSum[_gaugeType][nextTime].bias = _weight + _oldSum;
            timeSum[_gaugeType] = nextTime;
            pointsTotal[nextTime] = _oldTotal + _typeWeight * _weight;
            timeTotal = nextTime;

            pointsWeight[_addr][nextTime].bias = _weight;
        }

        if(timeSum[_gaugeType] == 0) {
            timeSum[_gaugeType] = nextTime;
        }
        timeWeight[_addr] = nextTime;

        emit NewGauge(_addr, _gaugeType, _weight);
    }

    function checkpoint() external {
        _getTotal();
    }

    function checkpointGauge(address _gaugeAddr) external {
        _getWeight(_gaugeAddr);
        _getTotal();
    }

    /**
        @notice Get Gauge relative weight (not more than 1.0) normalized to 1e18
            (e.g. 1.0 == 1e18). Inflation which will be received by it is
            inflation_rate * relative_weight / 1e18
        @param _addr Gauge address
        @param _time Relative weight at the specified timestamp in the past or present
        @return Value of relative weight normalized to 1e18
     */
    function _gaugeRelativeWeight(address _addr, uint256 _time) internal view returns(uint256) {
        uint256 t = _time / 1 weeks * 1 weeks;
        uint256 _totalWeight = pointsTotal[t];

        if(_totalWeight > 0) {
            uint256 gaugeType = gaugeTypes_[_addr] - 1;
            uint256 _typeWeight = pointsTypeWeight[gaugeType][t];
            uint256 _gaugeWeight = pointsWeight[_addr][t].bias;
            return MULTIPLIER * _typeWeight * _gaugeWeight / _totalWeight;
        } else {
            return 0;
        }
    }

    function gaugeRelativeWeight(address _addr, uint256 _time) public view returns(uint256) {
        return _gaugeRelativeWeight(_addr, _time);
    }

    function gaugeRelativeWeight(address _addr) external view returns(uint256) {
        return _gaugeRelativeWeight(_addr, block.timestamp);
    }

    /**
        @notice Get gauge weight normalized to 1e18 and also fill all the unfilled
            values for type and gauge records
        @dev Any address can call, however nothing is recorded if the values are filled already
        @param _addr Gauge address
        @param _time Relative weight at the specified timestamp in the past or present
        @return Value of relative weight normalized to 1e18
     */
    function gaugeRelativeWeightWrite(address _addr, uint256 _time) public returns(uint256) {
        _getWeight(_addr);
        _getTotal();
        return _gaugeRelativeWeight(_addr, _time);
    }

    function gaugeRelativeWeightWrite(address _addr) external returns(uint256) {
        return gaugeRelativeWeightWrite(_addr, block.timestamp);
    }

    /**
        @notice Change type weight
        @param _typeId Type id
        @param _weight New type weight
     */
    function _changeTypeWeight(uint256 _typeId, uint256 _weight) internal {
        uint256 oldWeight = _getTypeWeight(_typeId);
        uint256 oldSum = _getSum(_typeId);
        uint256 _totalWeight = _getTotal();
        uint256 nextTime = (block.timestamp + 1 weeks) / 1 weeks * 1 weeks;

        _totalWeight = _totalWeight + oldSum * _weight - oldSum * oldWeight;
        pointsTotal[nextTime] = _totalWeight;
        pointsTypeWeight[_typeId][nextTime] = _weight;
        timeTotal = nextTime;
        timeTypeWeight[_typeId] = nextTime;

        emit NewTypeWeight(_typeId, nextTime, _weight, _totalWeight);
    }

    /**
        @notice Add gauge type with name `_name` and weight `weight`
        @param _name Name of gauge type
        @param _weight Weight of gauge type
     */
    function addType(string memory _name, uint256 _weight) external onlyOwnershipAdmin {
        uint256 typeId = nGaugeTypes;
        gaugeTypeNames[typeId] = _name;
        nGaugeTypes = typeId + 1;
        if(_weight != 0) {
            _changeTypeWeight(typeId, _weight);
            emit AddType(_name, typeId);
        }
    }

    function changeTypeWeight(uint256 _typeId, uint256 _weight) external onlyOwnershipAdmin {
        _changeTypeWeight(_typeId, _weight);
    }

    function _changeGaugeWeight(address _addr, uint256 _weight) internal {
        uint256 gaugeType = gaugeTypes(_addr);
        uint256 oldGaugeWeight = _getWeight(_addr);
        uint256 typeWeight = _getTypeWeight(gaugeType);
        uint256 oldSum = _getSum(gaugeType);
        uint256 _totalWeight = _getTotal();
        uint256 nextTime = (block.timestamp + 1 weeks) / 1 weeks * 1 weeks;

        pointsWeight[_addr][nextTime].bias = _weight;
        timeWeight[_addr] = nextTime;

        uint256 newSum = oldSum + _weight - oldGaugeWeight;
        pointsSum[gaugeType][nextTime].bias = newSum;
        timeSum[gaugeType] = nextTime;

        _totalWeight = _totalWeight + newSum * typeWeight - oldSum * typeWeight;
        pointsTotal[nextTime] = _totalWeight;
        timeTotal = nextTime;

        emit NewGaugeWeight(_addr, _weight, _totalWeight);
    }

    function changeGaugeWeight(address _addr, uint256 _weight) external onlyOwnershipAdmin {
        _changeGaugeWeight(_addr, _weight);
    }

    /**
        @notice Allocate voting power for changing pool weights
        @param _gaugeAddr Gauge which `msg.sender` votes for
        @param _userWeight Weight for a gauge in bps (units of 0.01%). Minimal is 0.01%. Ignored if 0
     */
    function voteForGaugeWeights(address _gaugeAddr, uint256 _userWeight) external {
        VotedSlope memory newSlope;
        uint256 gaugeType = gaugeTypes(_gaugeAddr);
        uint256 nextTime = (block.timestamp + 1 weeks) / 1 weeks * 1 weeks;
        VotedSlope memory oldSlope = voteUserSlopes[msg.sender][_gaugeAddr];
        uint256 oldBias;
        uint256 newBias;
        {
            uint256 slope = uint256(uint128(votingEscrow.getLastUserSlope(msg.sender)));
            uint256 lockEnd = votingEscrow.lockedEnd(msg.sender);
            require(lockEnd > nextTime, "Your token lock expire too soon");
            require(_userWeight <= 10000, "you used all your voting power");
            require(block.timestamp >= lastUserVote[msg.sender][_gaugeAddr] + WEIGHT_VOTE_DELAY, "Cannot vote so often");

            uint256 oldDt = 0;
            if(oldSlope.end > nextTime) {
                oldDt = oldSlope.end - nextTime;
            }
            oldBias = oldSlope.slope * oldDt;
            newSlope = VotedSlope(
                slope * _userWeight / 10000,
                _userWeight,
                lockEnd
            );
            uint256 newDt = lockEnd - nextTime;
            newBias = newSlope.slope * newDt;
        }
        
        {
            // Check and update powers (weights) used
            uint256 powerUsed = voteUserPower[msg.sender];
            powerUsed = powerUsed + newSlope.power - oldSlope.power;
            voteUserPower[msg.sender] = powerUsed;
            require(powerUsed <= 10000, "Used too much power");
        }
        
        {
            // Remove old and schedule new slope changes
            // Remove slope changes for old slopes
            // Schedule recording of initial slope for next_time
            uint256 oldWeightBias = _getWeight(_gaugeAddr);
            uint256 oldWeightSlope = pointsWeight[_gaugeAddr][nextTime].slope;
            uint256 oldSumBias = _getSum(gaugeType);
            uint256 oldSumSlope = pointsSum[gaugeType][nextTime].slope;

            pointsWeight[_gaugeAddr][nextTime].bias = Math.max(oldWeightBias + newBias, oldBias) - oldBias;
            pointsSum[gaugeType][nextTime].bias = Math.max(oldSumBias + newBias, oldBias) - oldBias;
            if(oldSlope.end > nextTime) {
                pointsWeight[_gaugeAddr][nextTime].slope = Math.max(oldWeightSlope + newSlope.slope, oldSlope.slope) - oldSlope.slope;
                pointsSum[gaugeType][nextTime].slope = Math.max(oldSumSlope + newSlope.slope, oldSlope.slope) - oldSlope.slope;
            } else {
                pointsWeight[_gaugeAddr][nextTime].slope += newSlope.slope;
                pointsSum[gaugeType][nextTime].slope += newSlope.slope;
            }
            if(oldSlope.end > block.timestamp) {
                // Cancel old slope changes if they still didn't happen
                changesWeight[_gaugeAddr][oldSlope.end] -= oldSlope.slope;
                changesSum[gaugeType][oldSlope.end] -= oldSlope.slope;
            }
            // Add slope changes for new slopes
            changesWeight[_gaugeAddr][newSlope.end] += newSlope.slope;
            changesSum[gaugeType][newSlope.end] += newSlope.slope;
        }
        

        _getTotal();

        voteUserSlopes[msg.sender][_gaugeAddr] = newSlope;

        // Record last action time
        lastUserVote[msg.sender][_gaugeAddr] = block.timestamp;

        emit VoteForGauge(msg.sender, _gaugeAddr, _userWeight);
    }

    /**
        @notice Get current type weight
        @param _typeId Type id
        @return Type weight
     */
    function getTypeWeight(uint256 _typeId) external view returns(uint256) {
        return pointsTypeWeight[_typeId][timeTypeWeight[_typeId]];
    }

    /**
        @notice Get current total (type-weighted) weight
        @return Total weight
     */
    function getTotalWeight() external view returns(uint256) {
        return pointsTotal[timeTotal];
    }

    /**
        @notice Get sum of gauge weights per type
        @param _typeId Type id
        @return Sum of gauge weights
     */
    function getWeightsSumPerType(uint256 _typeId) external view returns(uint256) {
        return pointsSum[_typeId][timeSum[_typeId]].bias;
    }
}