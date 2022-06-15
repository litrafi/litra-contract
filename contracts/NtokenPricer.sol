pragma solidity ^0.8.0;

import "./PublicConfig.sol";
import "./order/OrderBook.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

interface AmmFactory {
    function getPair(address token0, address token1) external view returns(address);
}

interface AmmRouter {
    function factory() external view returns(address);
    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface AmmPair {
    function token0() external view returns(address);
    function token1() external view returns(address);
    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast);
}

contract NtokenPricer is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    address public weth;
    AmmRouter public router;
    OrderBook public orderBook;
    PublicConfig public config;
    // token address => dataFeed, for geting price from ChainLink: https://docs.chain.link/docs/get-the-latest-price/
    mapping(address => address) public dataFeeds;

    function initialize(
        address _weth,
        AmmRouter _router,
        OrderBook _orderBook,
        PublicConfig _config
    ) public initializer {
        __Ownable_init();

        weth = _weth;
        router = _router;
        orderBook = _orderBook;
        config = _config;
    }

    function setDataFeeds(address[] memory pricingTokens, address[] memory feeds) external onlyOwner {
        require(pricingTokens.length == feeds.length, "Wrong arr length");
        for (uint256 index = 0; index < pricingTokens.length; index++) {
            dataFeeds[pricingTokens[index]] = feeds[index];
        }
    }

    function getTnftPrice(address _tnft) external view returns(address pricingToken, uint256 amount, uint256 maxValuation) {
        address[] memory pricingTokens = config.getPricingTokens();

        for (uint256 index = 0; index < pricingTokens.length; index++) {
            address _pricingToken = pricingTokens[index];
            uint256 _priceFromAmm = getPriceFromAmm(_tnft, _pricingToken);
            uint256 _priceFromOrder = orderBook.getTnftPrice(_tnft, _pricingToken);
            uint256 higherPrice = _priceFromAmm > _priceFromOrder ? _priceFromAmm : _priceFromOrder;
            uint256 valuation = getValuation(_pricingToken, higherPrice);
            if(valuation > maxValuation) {
                pricingToken = _pricingToken;
                amount = higherPrice;
                maxValuation = valuation;
            }
        }
    }

    function getPriceFromAmm(address _tnft, address _pricingToken) public view returns(uint256) {
        _pricingToken = _pricingToken == address(0) ? weth : _pricingToken;

        AmmFactory factory = AmmFactory(router.factory());
        // check wheter AMM enable
        address pair = factory.getPair(_tnft, _pricingToken);
        if(pair == address(0)) {
            return 0;
        }
        // Get price by reserves
        (uint256 reserve0, uint256 reserve1, )= AmmPair(pair).getReserves();
        address token0 = AmmPair(pair).token0();
        uint256 reserveTnft;
        uint256 reservePricingToken;
        if(token0 == _tnft) {
            reserveTnft = reserve0;
            reservePricingToken = reserve1;
        } else {
            reserveTnft = reserve1;
            reservePricingToken = reserve0;
        }
        return uint(1e18).mul(reservePricingToken).div(reserveTnft);
    }

    function getValuation(address token, uint256 amount) public view returns(uint256) {
        require(dataFeeds[token] != address(0), "Data feed is not configured");
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = AggregatorV3Interface(dataFeeds[token]).latestRoundData();
        uint256 decimals = token == address(0) ? 18 : IERC20Metadata(token).decimals();
        return uint(price).mul(amount).div(10 ** decimals);
    }
}
