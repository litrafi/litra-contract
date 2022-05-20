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
- 函数定义: function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    )
- token: TNFT地址
- amountADesired: TNFT投入的数量
- amountTokenMin: TNFT投入池中最小数量
- amountETHMin: ETH投入池中的最小数量
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

#### 获取期权列表
- 函数定义: function getOptionsInfoByFilter(bool mine, bool ignoreStatus, OptionStatus status) external view returns(Option[] memory optionsInfo)
- mine: 是否与我有关
- igonreStatus: 是否无视状态筛选条件,用于期权功能界面列表时，此处应传false
- status: 期权状态筛选条件

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

## Lend

### LendBook

#### Total Supply TNTFs
- 变量定义: uint256 public totalTnfts

#### Total Borrowings
- 变量定义: uint256 public totalInterests

#### 获取借贷列表
- 函数定义: function getLendsInfoByFilter(
        bool _mine,
        bool _ignoreStatus,
        LendStatus _status
    ) external view returns(Lend[] memory _lends)
- _mine: 是否与"我"有关
- _ignoreStatus: 是否忽视状态筛选条件，用于借贷主界面列表时，应传false
- _status: 筛选状态
- Lend结构:

```
enum LendStatus {
    ACTIVE, // 0
    BORROWED, // 1
    OVERDUE, // 2
    CLOSED // 3
}
enum LendPeriod {
    ONE_WEEK,
    TWO_WEEK,
    ONE_MONTH,
    ONE_QUARTER,
    HALF_YEAR
}
struct Lend {
    uint256 lendId; // 借贷ID
    address borrower; // 借款人
    address tnft; // TNFT地址
    uint256 pledgedAmount; // 借款质押的TNFT数量
    uint256 borrowAmount; // 借款数量
    LendPeriod lendPeriod; // 借款时间
    uint256 interest; // 利息
    address lender; // 放款人
    uint256 lendTime; // 放款时间
    LendStatus status; // 借贷状态
}
```

#### 发起借贷
- 函数定义: function createLend(
        address _tnft,
        uint256 _pledgedAmount,
        uint256 _borrowAmount,
        uint256 _interest,
        LendPeriod _lendPeriod
    )
- _tnft: 质押的TNFT地址
- _pledgedAmount: 质押数量
- _borrowAmount: 借款数量
- _interest: 利息
- _lendPeriod: 借款时长

#### 取消借款
- 函数定义: function cancelLend(uint256 lendId)
- lendId: 借贷id
- 注：只能由借款人在未放款前取消借款

#### 放款
- 函数定义: function lend(uint256 lendId) external payable
- lendId: 借贷ID
- 注：放款将收取 borrowAmount - interest 数量的Native Token

#### 还款
- 函数定义: function payBack(uint256 lendId) external payable
- lendId: 借贷ID
- 注: 还款将收取 borrowAmount 数量的Native Token

## Auction

### AuctionBook

#### 获取Auction列表
- 函数定义: function getAuctionsInfoByFiler(bool _mine, bool _ignoreStatus, AuctionStatus _status) external view returns(Auction[] memory _auctions)
- _mine: 是否与我相关
- _ignoreStatus: 是否忽视状态筛选条件，用于借贷主界面列表时，应传false
- _status: 需要筛选的状态
- Auction结构:

```
enum AuctionStatus {
    ACTIVE,
    CLOSED
}

struct Auction {
    uint256 auctionId; // 拍卖ID
    address nft; // NFT地址
    uint256 tokenId; // NFT tokenId
    address creator; // 拍卖创建者
    uint256 highestOffer; // 拍卖当前最高价
    uint256 startingPrice; // 起拍价
    uint256 minimumOffer; // 拍卖当前最低价
    uint256 totalBids; // 竞标总价值
    address finalBuyer; // 最终购得者
    uint256 endTime; // 拍卖结束时间
    AuctionStatus status; // 拍卖状态
}
```

#### 获取拍卖历史竞标记录
- 函数定义: function getOfferHistory(uint256 auctionId) external view returns(Bid[] memory _bids)
- Bid 结构

```
struct Bid {
    uint256 bidId; // 投标id
    address bidder; // 投标人
    uint256 auctionId; // 拍卖ID
    uint256 offerPrice; // 报价
    uint256 bidTime; // 投标时间
}
```

#### 创建拍卖
- 函数定义: function createAuction(
        address _nft,
        uint256 _tokenId,
        uint256 _startingPrice,
        uint256 _endTime
    )
- _nft: NFT合约地址
- _tokenId: NFT tokenId
- _startPrice: 起拍价
- _endTime: 拍卖结束时间

#### 取消拍卖
- 函数定义: function cancelAuction(uint256 auctionId)
- 注：只能在第一支投标发生前取消拍卖

#### 投标
- 函数定义: function makeOffer(uint256 auctionId) external payable
- 注: 报价单位使用原生代币，通过value传值

#### 执行拍卖结果
- 函数定义: function executeAuctionResult(uint256 auctionId)
- 注: 执行拍卖结果必须在拍卖时间结束后

## 用户门户

### NftVault

#### 获取我的TNFT列表
- 函数定义: function getDepositedNftList(address account) external view returns(uint256[] memory)
- 注：函数返回TNFT id数组，id传入NftVault.nftInfo接口获取TNFT详细数据

### OptionBook

#### 获取与我相关的期权列表
- 函数定义: function getOptionsInfoByFilter(bool mine, bool ignoreStatus, OptionStatus status) external view returns(Option[] memory optionsInfo)
- mine: 是否与我有关
- igonreStatus: 是否无视状态筛选条件，此处应传true
- status: 期权状态筛选条件

### LendBook
#### 获取与我有关的借贷列表
- 函数定义: function getLendsInfoByFilter(
        bool _mine,
        bool _ignoreStatus,
        LendStatus _status
    ) external view returns(Lend[] memory _lends)
- _mine: 是否与"我"有关
- _ignoreStatus: 是否忽视状态筛选条件，此处应传true
- _status: 筛选状态

### AuctionBook
#### 与我有关的拍卖列表
- 函数定义: function getAuctionsInfoByFiler(bool _mine, bool _ignoreStatus, AuctionStatus _status) external view returns(Auction[] memory _auctions)
- _mine: 是否与我相关
- _ignoreStatus: 是否忽视状态筛选条件，此处应传true
- _status: 需要筛选的状态


