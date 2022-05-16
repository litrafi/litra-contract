# Archebase Interfaces

## Tokenize

### NftVault

#### 存入nft,并tokenize

- 函数定义: function deposit(
        address nft_, 
        uint256 tokenId_, 
        string memory name_, 
        string memory description_, 
        string memory ntokenName_, 
        uint256 supply_, 
        uint256 redeemRatio_
    ) external
- nft_: NFT 合约地址
- tokenId_: NFT的tokenId
- name_: NFT 名称
- description_: NFT描述
- ntokenName_: TNFT 名称
- supply_: TNFT总份数
- redeemRatio_: 赎回需要的TNFT数量，规定不允许小于或等于supply_的一半

#### 查看TNFT详细信息
- 变量定义: NftInfo[] public nftInfo
- 结构定义:

```
struct NftInfo {
    address owner; // NFT持有者
    address nftAddress; // NFT 地址
    uint256 tokenId; // NFT tokenId
    string name; // NFT 名称
    string description; // NFT 描述
    address ntokenAddress; // TNFT 地址
    uint256 supply; // TNFT总数量
    uint256 redeemRatio; // TNFT赎回所需最少数量
    uint256 redeemAmount; // 已赎回数量
    uint256 redeemPrice; // 开启赎回时，TNFT的单价
    NftStatus status; // 状态
}

enum NftStatus{
    TRADING, // 可交易
    REDEEMED, // 开始赎回
    END // 赎回结束
}
```

#### 查看用户持有的TNFT

- 函数定义: function getDepositedNftList(address account) external view returns(uint256[] memory)
- account: 用户地址
- returns: TNFT id,该id通过nftInfo接口可查出详细信息

#### 赎回NFT

- 函数定义: function redeem(
        address ntoken_,
        uint256 ntokenAmount_
    ) payable external
- ntoken_: TNFT地址
- ntokenAmount_: 用于赎回的TNFT数量，规定其必须大于redeemRatio

#### 发起赎回后，回收剩余TNFT

- 函数定义: function collectNtokens(
        address ntoken_,
        uint256 ntokenAmount_
    ) external
- ntoken_: TNFT地址
- ntokenAmount_: 回收的TNFT数量

## AMM

### UniswapV2Factory

#### 创建币对
- 函数定义: function createPair(address tokenA, address tokenB) external returns (address pair)
- tokenA,tokenB: 组成币对的两币地址

### UniswapV2Router

#### 添加流动性
- 函数定义: function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    )
- tokenA,tokenB: 组成币对的两币
- amountADesired, amountBDesired:添加的两币数量
- amountAMin,amountBMin: 币A/B被投入到池中的最小数量
- to: LP接受者
- deadline: 交易最迟完成时间

#### 买入指定数量的TNFT
- 函数定义: function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
- amountOutMin: 至少买到的TNFT数量
- path: [Wrapped Native Token地址, TNFT地址]
- to: 收款地址
- deadline: 交易最迟完成时间

#### 卖出指定数量的TNFT
- 函数定义: function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
- amountIn: 卖出的TNFT数量
- amountOutMin: 卖出所得ETH的最小数量
- path: [TNFT地址, Wrapped Native Token地址]
- to: 收款地址
- deadline: 交易最迟完成时间

## Order

### OrderBook

#### 创建订单
- 函数定义: function placeOrder(
        address _tnft,
        uint256 _tnftAmount,
        uint256 _price
    )
- _tnft: TNFT地址
- _tnftAmount: tnft的数量
- _price: tnft总价值

#### 获取订单列表
- 函数定义: function getOrdersByTNFT(address _tnft) external view returns(Order[] memory list)
- _tnft: TNFT地址
- Order结构

```
struct Order {
    uint256 orderId; // 订单ID
    address buyer; // 买家，未购买时为空地址
    address seller; // 卖家
    address tnft; // TNFT地址
    uint256 tnftAmount; // 订单卖出的TNFT数量
    uint256 price; // 订单总价格
    OrderStatus status; // 订单状态
}

enum OrderStatus {
    ACTIVE, // 可购买
    FINISHED, // 已购买
    CANCELED // 已被取消
}
```

#### 取消订单
- 函数定义: function cancelOrder(uint256 _orderId)
- _orderId: 订单id

#### 购买订单
- 函数定义: function buyOrder(uint256 _orderId) external payable
- _orderId: 订单id

## 期权

### OptionBook

#### 创建期权
- 函数定义: function createOption(
        address _tnft,
        uint256 _strikeAmount,
        uint256 _strikePrice,
        uint256 _premiumAmount,
        OptionExpiration _expiration
    )
- _tnft: TNFT地址
- _strikeAmount: 期权约定的TNFT数量
- _strikePrice: TNFT单价
- _premiumAmount: 购买期权需预先支付的保障金/违约金/手续费
- _expiration: 从期权创建到行权日的时间

#### 期权详细信息
- 变量定义: Option[] public options
- Option结构

```
struct Option {
    uint256 optionId; // 期权ID
    address payable creater; // 期权创建人，卖家
    address tnft; // TNFT 价格
    uint256 strikeAmount; // 交易的TNFT数量
    uint256 strikePrice; // 交易的TNFT单价
    uint256 premiumAmount; // 交易保证金
    uint256 createdTime; // 期权创建时间
    OptionExpiration expiration; // 期权创建至行权日时间间隔
    address buyer; // 买家
    OptionStatus status; // 期权状态
}

enum OptionStatus {
    UNFILLED, // 已创建，未购买
    PURCHASED, // 已购买，未行权
    CLOSED // 已关闭
}

enum OptionExpiration {
    ONE_WEEK,
    TOW_WEEKS,
    ONE_MONTH
}
```

#### 购买期权
- 函数定义: function purchaseOption(uint256 optionId) external payable
- optionId: 期权id

#### 买家行权
- 函数定义: function executeOption(uint256 optionId) external payable
- optionId: 期权id
- 注： 买家行权时需支付strikeAmount * strikePrice / 1e6数量的本网原始币(Native Token)

#### 卖家取消期权
- 函数定义: function sellerCancelOption(uint256 optionId)
- 注： 卖家只能在期权未被购买前取消

#### 买家放弃行权
- 函数定义: function buyerCancelOption(uint256 optionId) external
- 注：买家只能在购买期权后且未行权前放弃行权