pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ARCB is ERC20 {
    event UpdateMiningParameters(uint256 rate, uint256 supply);
    event SetMinter(address minter);
    event SetAdmin(address minter);

    uint256 constant private YEAR = 86400 * 365;
    uint256 constant private INITIAL_SUPPLY = 1_303_030_303;
    // leading to 43% premine
    uint256 constant private INITIAL_RATE = 274_815_283 * 10 ** 18 / YEAR;
    uint256 constant private RATE_REDUCTION_TIME = YEAR;
    // 2 ** (1/4) * 1e18;
    uint256 constant private RATE_REDUCTION_COEFFICIENT = 1189207115002721024;
    uint256 constant private RATE_DENOMINATOR = 10 ** 18;
    uint256 constant private INFLATION_DELAY = 86400;

    int128 public miningEpoch;
    uint256 public startEpochTime;
    uint256 public rate;

    address public minter;
    address public admin;

    uint256 private startEpochSupply;

    constructor() ERC20('ArcheBase Token', 'ARCB') {
        uint256 initSupply = INITIAL_SUPPLY * 10 ** decimals();
        _mint(_msgSender(), initSupply);
        admin = _msgSender();
        startEpochTime = block.timestamp + INFLATION_DELAY - RATE_REDUCTION_COEFFICIENT;
        miningEpoch = -1;
        rate = 0;
        startEpochSupply = initSupply;
    }
    
    function _updateMiningParamters() internal {
        uint256 _startEpochSupply = startEpochSupply;
        uint256 _rate = rate;
        startEpochTime += RATE_REDUCTION_TIME;
        miningEpoch += 1;
        
        if(rate == 0) {
            _rate = INITIAL_RATE;
        } else {
            _startEpochSupply += _rate * RATE_REDUCTION_TIME;
            _rate = _rate * RATE_DENOMINATOR / RATE_REDUCTION_COEFFICIENT;
        }

        startEpochSupply = _startEpochSupply;
        rate = _rate;

        emit UpdateMiningParameters(rate, startEpochSupply);
    }

    function updateMiningParamters() external {
        require(block.timestamp >= startEpochTime + RATE_REDUCTION_TIME, 'Not time');
        _updateMiningParamters();
    }

    function startEpochTimeWrite() external returns(uint256) {
        uint256 _startEpochTime = startEpochTime;
        if(block.timestamp >= startEpochTime + RATE_REDUCTION_TIME) {
            _updateMiningParamters();
            return startEpochTime;
        } else {
            return _startEpochTime;
        }
    }

    function futureEpochTimeWrite() external returns(uint256) {
        uint256 _startEpochTime = startEpochTime;
        if(block.timestamp >= startEpochTime + RATE_REDUCTION_TIME) {
            _updateMiningParamters();
            return startEpochTime + RATE_REDUCTION_TIME;
        } else {
            return _startEpochTime + RATE_REDUCTION_TIME;
        }
    }

    function _availiableSupply() internal view returns(uint256) {
        return startEpochSupply + (block.timestamp - startEpochTime) * rate;
    }

    function availiableSupply() external view returns(uint256) {
        return _availiableSupply();
    }
    /**
        @notice How much supply is mintable from start timestamp till end timestamp
     */
    function mintableInTimeframe(uint256 start, uint256 end) external view returns(uint256) {
        require(start <= end, "End gte start");

        uint256 toMint = 0;
        uint256 currentEpochTime = startEpochTime;
        uint256 currentRate = rate;

        // End is in future epoch
        if(end >= currentEpochTime + RATE_REDUCTION_TIME) {
            currentEpochTime += RATE_REDUCTION_TIME;
            currentRate = currentRate * RATE_DENOMINATOR / RATE_REDUCTION_COEFFICIENT;
        }

        require(end <= currentEpochTime + RATE_REDUCTION_TIME, "End is too far in future");

        for (uint256 index = 0; index < 1000; index++) {
            if(end >= currentEpochTime) {
                uint256 currentEnd = end;
                if(currentEnd > currentEpochTime + RATE_REDUCTION_TIME) {
                    currentEnd = currentEpochTime + RATE_REDUCTION_TIME;
                }

                uint256 currentStart = start;
                if(currentStart >= currentEpochTime + RATE_REDUCTION_TIME) {
                    break;
                } else if(currentStart < currentEpochTime) {
                    currentStart = currentEpochTime;
                }

                toMint += currentRate * (currentEnd - currentStart);

                if(start >= currentEpochTime) {
                    break;
                }
            }

            currentEpochTime -= RATE_REDUCTION_TIME;
            currentRate = currentRate * RATE_REDUCTION_COEFFICIENT / RATE_DENOMINATOR;
            require(currentRate <= INITIAL_RATE, "End is too early");
        }

        return toMint;
    }

    function setMinter(address _minter) external {
        require(_msgSender() == admin, "!admin");
        require(minter == address(0), "Already set");
        minter = _minter;
        emit SetMinter(_minter);
    }

    function setAmind(address _admin) external {
        require(_msgSender() == admin, "!admin");
        admin = _admin;
        emit SetAdmin(_admin);
    }

    function mint(address _to, uint256 _value) external {
        require(_msgSender() == minter, "!minter");
        require(_to != address(0), "Zero address");

        if(block.timestamp >= startEpochTime + RATE_REDUCTION_TIME) {
            _updateMiningParamters();
        }

        _mint(_to, _value);
    }

    function burn(uint256 _value) external {
        _burn(_msgSender(), _value);
    }
}