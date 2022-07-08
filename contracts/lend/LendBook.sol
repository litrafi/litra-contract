pragma solidity ^0.8.0;

import "../PublicConfig.sol";
import "../tokenize/Ntoken.sol";
import "../libs/TransferLib.sol";
import "../NtokenPricer.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract LendBook is OwnableUpgradeable, ReentrancyGuardUpgradeable {

    using SafeMath for uint256;
    using AddressUpgradeable for address payable;

    event CreateLend(uint256 indexed lendId, address borrower);
    event CancelLend(uint256 indexed lendId, address borrower);
    event LendEvent(uint256 indexed lendId, address lender);
    event Payback(uint256 indexed lendId, address borrower);

    enum LendPeriod {
        ONE_WEEK,
        TWO_WEEK,
        ONE_MONTH,
        ONE_QUARTER,
        HALF_YEAR
    }

    enum LendStatus {
        ACTIVE,
        BORROWED,
        OVERDUE,
        CLOSED
    }

    struct Lend {
        uint256 lendId;
        address borrower;
        address tnft;
        uint256 pledgedAmount;
        address pricingToken;
        uint256 borrowAmount;
        LendPeriod lendPeriod;
        uint256 interest;
        address lender;
        uint256 lendTime;
        LendStatus status;
    }

    uint256 public totalTnfts;
    PublicConfig public config;
    NtokenPricer public pricer;
    uint256 public totalInterests;

    Lend[] public lends;

    function initialize(PublicConfig _config) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        config = _config;
    }
    // ======== External View ======== //

    function lendsLength() external view returns(uint256) {
        return lends.length;
    }

    // ======== External Modify ======== //

    function createLend(
        address _tnft,
        uint256 _pledgedAmount,
        address _pricingToken,
        uint256 _borrowAmount,
        uint256 _interest,
        LendPeriod _lendPeriod
    ) external {
        require(_pledgedAmount != 0, "Invalid pledged amount");
        require(_borrowAmount != 0, "Invalid borrow amount");
        require(_interest < _borrowAmount, "Invalid interest");
        require(config.isPrcingToken(_pricingToken), 'Invalid pricing token');

        Ntoken(_tnft).transferFrom(msg.sender, address(this), _pledgedAmount);

        uint256 lendId = lends.length;
        lends.push(Lend({
            lendId: lendId,
            borrower: msg.sender,
            tnft: _tnft,
            pledgedAmount: _pledgedAmount,
            pricingToken: _pricingToken,
            borrowAmount: _borrowAmount,
            lendPeriod: _lendPeriod,
            interest: _interest,
            lender: address(0),
            lendTime: 0,
            status: LendStatus.ACTIVE
        }));

        totalTnfts = totalTnfts.add(_pledgedAmount);
        totalInterests = totalInterests.add(_interest);

        emit CreateLend(lendId, msg.sender);
    }

    function cancelLend(uint256 lendId) external {
        require(lendId < lends.length, "Invalid lendId");
        Lend storage _lend = lends[lendId];

        require(_lend.borrower == msg.sender, "Forbidden");
        require(_lend.status == LendStatus.ACTIVE, "Invalid lend");

        _lend.status = LendStatus.CLOSED;
        totalTnfts = totalTnfts.sub(_lend.pledgedAmount);
        totalInterests = totalInterests.sub(_lend.interest);

        Ntoken(_lend.tnft).transfer(msg.sender, _lend.pledgedAmount);

        emit CancelLend(lendId, _lend.borrower);
    }

    function lend(uint256 lendId) external payable nonReentrant {
        require(lendId < lends.length, "Invalid lendId");
        Lend storage _lend = lends[lendId];
        require(_lend.status == LendStatus.ACTIVE, "Invalid lend");
        uint256 received = _lend.borrowAmount.sub(_lend.interest);

        _lend.lender = msg.sender;
        _lend.lendTime = block.timestamp;
        _lend.status = LendStatus.BORROWED;

        TransferLib.transferFrom(_lend.pricingToken, msg.sender, payable(_lend.borrower), received, msg.value);

        emit LendEvent(lendId, _lend.lender);
    }

    /**
    TODO: Overdue paying back need extra fee
     */
    function payBack(uint256 lendId) external payable nonReentrant {
        require(lendId < lends.length, "Invalid lendId");
        Lend storage _lend = lends[lendId];

        require(msg.sender == _lend.borrower, "Forbidden");
        require(_lend.status == LendStatus.BORROWED, "Invalid lend");

        _lend.status = LendStatus.CLOSED;

        Ntoken(_lend.tnft).transfer(_lend.borrower, _lend.pledgedAmount);
        TransferLib.transferFrom(_lend.pricingToken, msg.sender, payable(_lend.lender), _lend.borrowAmount, msg.value);

        emit Payback(lendId, _lend.borrower);
    }

    // function forcePayLend(uint256 lendId) external payable nonReentrant {
    //     require(lendId < lends.length, "Invalid lendId");
    //     Lend storage _lend = lends[lendId];

    //     require(msg.sender == _lend.lender, "Forbidden");
    //     require(isOverdue(_lend), "Forbidden now");

    //     _lend.status = LendStatus.CLOSED;
    //     totalTnfts = totalTnfts.sub(_lend.pledgedAmount);

    //     Ntoken(_lend.tnft).transfer(_lend.lender, _lend.pledgedAmount);
    // }

    function getLendPeriodSeconds(LendPeriod _period) internal pure returns(uint256) {
        if(_period == LendPeriod.ONE_WEEK) {
            return 604800;
        }
        if(_period == LendPeriod.TWO_WEEK) {
            return 1209600;
        }
        if(_period == LendPeriod.ONE_MONTH) {
            return 2592000;
        }
        if(_period == LendPeriod.ONE_QUARTER) {
            return 7776000;
        }
        if(_period == LendPeriod.HALF_YEAR) {
            return 15552000;
        }
    }

    function isOverdue(Lend memory _lend) internal view returns(bool) {
        if(_lend.status != LendStatus.BORROWED) {
            return false;
        }

        uint256 lendPeriod = getLendPeriodSeconds(_lend.lendPeriod);
        if(block.timestamp >= _lend.lendTime.add(lendPeriod)) {
            return true;
        } else {
            return false;
        }
    }
}