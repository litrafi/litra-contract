pragma solidity ^0.8.0;

import "./PublicConfig.sol";
import "./interfaces/Amm.sol";
import "./order/OrderBook.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract Dashboard is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    AmmRouter public router;
    AmmFactory public factory;
    OrderBook public orderBook;
    PublicConfig public config;

    function initialize(
        AmmRouter _router,
        OrderBook _orderBook,
        PublicConfig _config
    ) external initializer {
        __Ownable_init();

        router = _router;
        factory = AmmFactory(router.factory());
        orderBook = _orderBook;
        config = _config;
    }

    function getTnftCirculation(address _tnft) external view returns(uint256) {
        uint256 ammSupply;
        address[] memory pricingTokens = config.getPricingTokens();
        for (uint256 index = 0; index < pricingTokens.length; index++) {
            address pricingToken = pricingTokens[index];
            if(pricingToken == address(0)) {
                pricingToken = config.weth();
            }
            address pair = factory.getPair(pricingToken, _tnft);
            if(pair == address(0)) {
                continue;
            }
            address token0 = AmmPair(pair).token0();
            (uint256 reserve0, uint256 reserve1, ) = AmmPair(pair).getReserves();
            if(token0 == _tnft) {
                ammSupply = ammSupply.add(reserve0);
            } else {
                ammSupply = ammSupply.add(reserve1);
            }
        }

        uint256 ordersSupply = orderBook.tnftCirculation(_tnft);
        return ammSupply.add(ordersSupply);
    }
}