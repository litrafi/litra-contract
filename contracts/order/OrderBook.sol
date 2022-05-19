pragma solidity ^0.8.0;

import "../tokenize/Ntoken.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract OrderBook is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
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
        uint256 price;
        OrderStatus status;
    }

    Order[] public orders;
    mapping(address => uint256[]) public tnftOrders;
    mapping(address => uint256[]) public dealedTnftOrders;

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    function getOrdersByTNFT(address _tnft) external view returns(Order[] memory list) {
        uint256[] memory orderIds = tnftOrders[_tnft];
        list = new Order[](orderIds.length);

        for (uint256 index = 0; index < orderIds.length; index++) {
            list[index] = orders[orderIds[index]];
        }
    }

    function getTnftPrice(address _tnft) external view returns(uint256) {
        uint256[] memory dealedOrders = dealedTnftOrders[_tnft];
        if(dealedOrders.length == 0) {
            return 0;
        }
        return orders[dealedOrders[dealedOrders.length - 1]].price;
    }

    function placeOrder(
        address _tnft,
        uint256 _tnftAmount,
        uint256 _price
    ) external {
        Ntoken tnft = Ntoken(_tnft);
        require(_tnftAmount > 0, "Invalid tnft amount");
        require(_price > 0, "Invalid price");

        tnft.transferFrom(msg.sender, address(this), _tnftAmount);

        uint256 orderId = orders.length;

        orders.push(
            Order({
                orderId: orderId,
                buyer: address(0),
                seller: msg.sender,
                tnft: _tnft,
                tnftAmount: _tnftAmount,
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
        require(msg.value == order.price, "Wrong offer");

        order.buyer = msg.sender;
        order.status = OrderStatus.FINISHED;
        dealedTnftOrders[order.tnft].push(_orderId);

        Ntoken(order.tnft).transfer(msg.sender, order.tnftAmount);
        payable(order.seller).sendValue(order.price);

        emit BuyOrder(_orderId, msg.sender);
    }
}