pragma solidity ^0.8.0;

import "../PublicConfig.sol";
import "../tokenize/Ntoken.sol";
import "../libs/TransferLib.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 TODO: 买家行权应设置期限，逾期未行权将采取反制措施：卖家将有权行权或取消合约？ 
 */
contract OptionBook is OwnableUpgradeable, ReentrancyGuardUpgradeable {
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
        address payable creator;
        address tnft;
        address pricingToken;
        uint256 strikeAmount;
        uint256 strikePrice;
        uint256 premiumAmount;
        uint256 createdTime;
        OptionExpiration expiration;
        address buyer;
        OptionStatus status;
    }

    Option[] public options;
    PublicConfig public config;
    uint256 constant public STRIKE_PRICE_MULTIPLIER = 1e18;
    uint256 public executionTime; 

    function initialize(PublicConfig _config) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        config = _config;
        // 3 days
        executionTime = 259200;
    }

    // ======== Public View ======== //
    
    function optionsLength() public view returns(uint) {
        return options.length;
    }

    // ======== External Modify ======== //

    function createOption(
        address _tnft,
        address _pricingToken,
        uint256 _strikeAmount,
        uint256 _strikePrice,
        uint256 _premiumAmount,
        OptionExpiration _expiration
    ) external {
        Ntoken tnft = Ntoken(_tnft);
        require(_strikeAmount > 0, "Invalid strike amount");
        require(_strikePrice > 0, "Invliad strike price");
        require(config.isPrcingToken(_pricingToken), 'Invalid pricing token');
        
        tnft.transferFrom(msg.sender, address(this), _strikeAmount);

        uint256 optionId = options.length;
        options.push(
            Option({
                optionId: optionId,
                creator: payable(msg.sender),
                tnft: _tnft,
                pricingToken: _pricingToken,
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

        require(option.status == OptionStatus.UNFILLED, "Invalid option");

        option.buyer = msg.sender;
        option.status = OptionStatus.PURCHASED;

        TransferLib.transferFrom(option.pricingToken, msg.sender, option.creator, option.premiumAmount, msg.value);

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
        require(option.status == OptionStatus.PURCHASED, "Invalid option");

        option.status = OptionStatus.CLOSED;

        TransferLib.transferFrom(option.pricingToken, msg.sender, option.creator, payment, msg.value);
        Ntoken(option.tnft).transfer(msg.sender, option.strikeAmount);

        emit ExecuteOption(optionId, msg.sender);
    }

    function sellerCancelOption(uint256 optionId) external {
        require(optionId < options.length, "Invalid optionId");
        Option storage option = options[optionId];

        require(
            option.status == OptionStatus.UNFILLED
            || (option.status == OptionStatus.PURCHASED && isExecutionTimeExpired(option))
        , "Invalid option");
        require(msg.sender == option.creator, "Forbidden");

        option.status = OptionStatus.CLOSED;
        Ntoken(option.tnft).transfer(option.creator, option.strikeAmount);
    }

    function buyerCancelOption(uint256 optionId) external {
        require(optionId < options.length, "Invalid optionId");
        Option storage option = options[optionId];

        require(option.status == OptionStatus.PURCHASED, "Invalid option");
        require(msg.sender == option.buyer, "Forbidden");

        option.status = OptionStatus.CLOSED;
        Ntoken(option.tnft).transfer(option.creator, option.strikeAmount);
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

    function isExecutionTimeExpired(Option memory option) private view returns(bool) {
        return block.timestamp >= option.createdTime.add(getExpirationSeconds(option.expiration)).add(executionTime);
    }
}