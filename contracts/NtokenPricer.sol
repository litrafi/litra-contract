pragma solidity ^0.8.0;

import "./order/OrderBook.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface AmmFactory {
    function getPair(address token0, address token1) external view returns(address);
}

interface AmmRouter {
    function factory() external view returns(address);
    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

contract NtokenPricer is Initializable {

    address public weth;
    AmmRouter public router;
    OrderBook public orderBook;

    function initialize(
        address _weth,
        AmmRouter _router,
        OrderBook _orderBook
    ) public initializer {
        weth = _weth;
        router = _router;
        orderBook = _orderBook;
    }

    function getTnftPrice(address _tnft) external view returns(uint256) {
        uint256 priceFromAmm = getPriceFromAmm(_tnft);
        uint256 priceFromOrder = orderBook.getTnftPrice(_tnft);
        return priceFromAmm > priceFromOrder ? priceFromAmm : priceFromOrder;
    }

    function getPriceFromAmm(address _tnft) public view returns(uint256) {
        AmmFactory factory = AmmFactory(router.factory());
        // check wheter AMM enable
        address pair = factory.getPair(_tnft, weth);
        if(pair == address(0)) {
            return 0;
        }
        // Get price by router
        uint256 decimals = Ntoken(_tnft).decimals();
        address[] memory path = new address[](2);
        path[0] = _tnft;
        path[1] = weth;
        uint256[] memory amounts = router.getAmountsOut(10 ** decimals, path);
        return amounts[1];
    }
}
