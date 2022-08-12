pragma solidity ^0.8.0;

import "./PublicConfig.sol";
import "./interfaces/Amm.sol";
import "./order/OrderBook.sol";

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract Dashboard is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    IUniswapV3Factory public factory;
    OrderBook public orderBook;
    PublicConfig public config;

    function initialize(
        IUniswapV3Factory _fatory,
        OrderBook _orderBook,
        PublicConfig _config
    ) external initializer {
        __Ownable_init();

        factory = _fatory;
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
            address pool = factory.getPool(pricingToken, _tnft, config.DEFAULT_SWAP_FEE());
            if(pool == address(0)) {
                continue;
            }
            uint256 reserve0 = IUniswapPool(pool).balance0();
            uint256 reserve1 = IUniswapPool(pool).balance1();
            if(IUniswapPool(pool).token0() == _tnft) {
                ammSupply = ammSupply.add(reserve0);
            } else {
                ammSupply = ammSupply.add(reserve1);
            }
        }

        uint256 ordersSupply = orderBook.tnftCirculation(_tnft);
        return ammSupply.add(ordersSupply);
    }
}