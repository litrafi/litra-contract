pragma solidity ^0.8.0;

import "../tokenize/Ntoken.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 TODO: 买家行权应设置期限，逾期未行权将采取反制措施：卖家将有权行权或取消合约？ 
 */
contract OptionBook is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address payable;

    event CreateOption(uint256 indexed optionId, address creator);
    event PurchaseOption(uint256 indexed optionId, address buyer);
    event ExecuteOption(uint256 indexed optionId, address operator);

    enum OptionExpiration {
        ONE_WEEK,
        TOW_WEEKS,
        ONE_MONTH
    }

    enum OptionStatus {
        UNFILLED,
        PURCHASED,
        CLOSED
    }

    struct Option {
        uint256 optionId;
        address payable creater;
        address tnft;
        uint256 strikeAmount;
        uint256 strikePrice;
        uint256 premiumAmount;
        uint256 createdTime;
        OptionExpiration expiration;
        address buyer;
        OptionStatus status;
    }

    Option[] public options;
    uint256 constant public STRIKE_PRICE_MULTIPLIER = 1e18;

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    // function getOptionsInfo(uint256[] memory optionsId) external view returns(Option[] memory optionsInfo) {
    //     optionsInfo = new Option[](optionsId.length);

    //     for (uint256 index = 0; index < optionsId.length; index++) {
    //         optionsInfo[index] = options[optionsId[index]];
    //     }
    // }

    function getOptionsInfoByFilter(bool mine, OptionStatus status) external view returns(Option[] memory optionsInfo) {
        // get count for creating arr
        uint256 count = 0;
        for (uint256 index = 0; index < options.length; index++) {
            Option memory option = options[index];
            bool isRelevant = option.creater == msg.sender || option.buyer == msg.sender;
            if(option.status == status && (!mine || isRelevant)) {
                count ++;
            }
        }
        // push option info to arr
        optionsInfo = new Option[](count);
        count = 0;
        for (uint256 index = 0; index < options.length; index++) {
            Option memory option = options[index];
            bool isRelevant = option.creater == msg.sender || option.buyer == msg.sender;
            if(option.status == status && (!mine || isRelevant)) {
                optionsInfo[count] = option;
                count ++;
            }
        }
    }

    function createOption(
        address _tnft,
        uint256 _strikeAmount,
        uint256 _strikePrice,
        uint256 _premiumAmount,
        OptionExpiration _expiration
    ) external {
        Ntoken tnft = Ntoken(_tnft);
        require(_strikeAmount > 0, "Invalid strike amount");
        require(_strikePrice > 0, "Invliad strike price");
        
        tnft.transferFrom(msg.sender, address(this), _strikeAmount);

        uint256 optionId = options.length;
        options.push(
            Option({
                optionId: optionId,
                creater: payable(msg.sender),
                tnft: _tnft,
                strikeAmount: _strikeAmount,
                strikePrice: _strikePrice,
                premiumAmount: _premiumAmount,
                createdTime: block.timestamp,
                expiration: _expiration,
                buyer: address(0),
                status: OptionStatus.UNFILLED
            })
        );

        emit CreateOption(optionId, msg.sender);
    }

    function purchaseOption(uint256 optionId) external payable nonReentrant {
        require(optionId < options.length, "Invalid optionId");
        Option storage option = options[optionId];

        require(msg.value == option.premiumAmount, "Wrong value");
        require(option.status == OptionStatus.UNFILLED, "Invalid option");

        option.buyer = msg.sender;
        option.status = OptionStatus.PURCHASED;

        option.creater.sendValue(msg.value);

        emit PurchaseOption(optionId, msg.sender);
    }

    function executeOption(uint256 optionId) external payable nonReentrant {
        require(optionId < options.length, "Invalid optionId");

        Option storage option = options[optionId];
        uint256 payment = option.strikeAmount.mul(option.strikePrice).div(STRIKE_PRICE_MULTIPLIER);
        
        require(msg.sender == option.buyer, "Forbidden");
        require(
            block.timestamp >= option.createdTime.add(getExpirationSeconds(option.expiration)),
            "Can't execute now"
        );
        require(msg.value == payment, "Wrong value");
        require(option.status == OptionStatus.PURCHASED, "Invalid option");

        option.status = OptionStatus.CLOSED;

        option.creater.sendValue(msg.value);
        Ntoken(option.tnft).transfer(msg.sender, option.strikeAmount);

        emit ExecuteOption(optionId, msg.sender);
    }

    function sellerCancelOption(uint256 optionId) external {
        require(optionId < options.length, "Invalid optionId");
        Option storage option = options[optionId];

        require(option.status == OptionStatus.UNFILLED, "Invalid option");
        require(msg.sender == option.creater, "Forbidden");

        option.status = OptionStatus.CLOSED;
        Ntoken(option.tnft).transfer(option.creater, option.strikeAmount);
    }

    function buyerCancelOption(uint256 optionId) external {
        require(optionId < options.length, "Invalid optionId");
        Option storage option = options[optionId];

        require(option.status == OptionStatus.PURCHASED, "Invalid option");
        require(msg.sender == option.buyer, "Forbidden");

        option.status = OptionStatus.CLOSED;
        Ntoken(option.tnft).transfer(option.creater, option.strikeAmount);
    }

    function getExpirationSeconds(OptionExpiration expiration) private pure returns(uint256 _seconds) {
        if(expiration == OptionExpiration.ONE_WEEK) {
            _seconds = 604800;
        } else if(expiration == OptionExpiration.TOW_WEEKS) {
            _seconds = 1209600;
        } else if(expiration == OptionExpiration.ONE_MONTH) {
            _seconds = 2592000;
        } else {
            require(false, "Invalid expiration");
        }
    }
}