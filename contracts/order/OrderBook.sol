pragma solidity ^0.8.0;

import "../PublicConfig.sol";
import "../tokenize/Ntoken.sol";
import "../libs/TransferLib.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract OrderBook is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address payable;

    event PlaceOrder(uint256 indexed orderId, address seller);
    event CancelOrder(uint256 indexed orderId, address operator);
    event BuyOrder(uint256 indexed orderId, address buyer);

    enum OrderStatus {
        ACTIVE,
        FINISHED,
        CANCELED
    }

    struct Order {
        uint256 orderId;
        address buyer;
        address seller;
        address tnft;
        uint256 tnftAmount;
        address pricingToken;
        uint256 price;
        OrderStatus status;
    }

    Order[] public orders;
    PublicConfig public config;
    mapping(address => uint256[]) public tnftOrders;
    // TNFT => pricing token => order id
    mapping(address => mapping(address => uint256[])) public dealedTnftOrders;
    EnumerableSetUpgradeable.AddressSet private tokenPriceWhitelist;

    function initialize(PublicConfig _config) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        config = _config;
    }

    // ======== Public View ======== //

    function getTnftPrice(address _tnft, address _pricingToken) external view returns(uint256) {
        uint256[] memory dealedOrders = dealedTnftOrders[_tnft][_pricingToken];
        if(dealedOrders.length == 0) {
            return 0;
        }
        Order memory lastOrder = orders[dealedOrders[dealedOrders.length - 1]];
        return lastOrder.price.mul(10 ** 18).div(lastOrder.tnftAmount);
    }

    // ======== External Modify ======== //

    function placeOrder(
        address _tnft,
        uint256 _tnftAmount,
        address _pricingToken,
        uint256 _price
    ) external {
        require(_tnftAmount > 0, "Invalid tnft amount");
        require(_price > 0, "Invalid price");
        require(config.isPrcingToken(_pricingToken), 'Invalid pricing token');
        require(config.isNtoken(_tnft), 'Invalid tnft');

        Ntoken tnft = Ntoken(_tnft);

        tnft.transferFrom(msg.sender, address(this), _tnftAmount);

        uint256 orderId = orders.length;

        orders.push(
            Order({
                orderId: orderId,
                buyer: address(0),
                seller: msg.sender,
                tnft: _tnft,
                tnftAmount: _tnftAmount,
                pricingToken: _pricingToken,
                price: _price,
                status: OrderStatus.ACTIVE
            })
        );
        tnftOrders[_tnft].push(orderId);

        emit PlaceOrder(orderId, msg.sender);
    }

    function cancelOrder(uint256 _orderId) external {
        require(_orderId < orders.length, "Invalid order id");
        Order storage order = orders[_orderId];
        require(order.seller == msg.sender, "Forbidden cancling");
        require(order.status == OrderStatus.ACTIVE, "Invalid order");

        order.status = OrderStatus.CANCELED;
        Ntoken(order.tnft).transfer(msg.sender, order.tnftAmount);

        emit CancelOrder(_orderId, msg.sender);
    }

    function buyOrder(uint256 _orderId) external payable {
        require(_orderId < orders.length, "Invalid order id");
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.ACTIVE, "Invalid order");

        order.buyer = msg.sender;
        order.status = OrderStatus.FINISHED;
        dealedTnftOrders[order.tnft][order.pricingToken].push(_orderId);

        Ntoken(order.tnft).transfer(msg.sender, order.tnftAmount);
        TransferLib.transferFrom(order.pricingToken, msg.sender, payable(order.seller), order.price, msg.value);

        emit BuyOrder(_orderId, msg.sender);
    }
}