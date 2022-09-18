pragma solidity ^0.8.0;

import "./PublicConfig.sol";
import "./order/OrderBook.sol";

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract NtokenPricer is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    IUniswapV3Factory public factory;
    OrderBook public orderBook;
    PublicConfig public config;
    // token address => dataFeed, for geting price from ChainLink: https://docs.chain.link/docs/get-the-latest-price/
    mapping(address => address) public dataFeeds;
    uint256 constant private MAX_INT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant private Q_MULTIPLIER = 4 ** 96;
    uint64 constant private TNFT_DECIMALS_MULTIPLIER = 1e18;
    uint256 constant private Q_TNFT_DECIMALS_MULTIPLIER = Q_MULTIPLIER * TNFT_DECIMALS_MULTIPLIER;

    function initialize(
        IUniswapV3Factory _factory,
        OrderBook _orderBook,
        PublicConfig _config
    ) public initializer {
        __Ownable_init();

        factory = _factory;
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
        _pricingToken = _pricingToken == address(0) ? config.weth() : _pricingToken;

        // check wheter AMM enable
        address pool = factory.getPool(_tnft, _pricingToken, config.DEFAULT_SWAP_FEE());
        if(pool == address(0)) {
            return 0;
        }
        // Get price by reserves
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        // tnft is token0
        if(_tnft < _pricingToken) {
            uint256 price = uint256(sqrtPriceX96).mul(sqrtPriceX96);
            return price < MAX_INT.div(TNFT_DECIMALS_MULTIPLIER)
                ? price.mul(TNFT_DECIMALS_MULTIPLIER).div(Q_MULTIPLIER)
                : price.div(Q_MULTIPLIER).mul(TNFT_DECIMALS_MULTIPLIER);
        } else {
            return Q_TNFT_DECIMALS_MULTIPLIER.div(sqrtPriceX96).div(sqrtPriceX96);
        }
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
        uint256 valuation = uint(price).mul(amount).div(10 ** decimals);
        uint8 usdtDecimals = IERC20Metadata(config.usdt()).decimals();
        uint8 priceDecimals = AggregatorV3Interface(dataFeeds[token]).decimals();
        return valuation.mul(10 ** usdtDecimals).div(10 ** priceDecimals);
    }
}
