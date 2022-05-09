// SPDX-License-Identifier: MIT
pragma solidity =0.6.12;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import "./NtokenFactory.sol";
import "../libraries/String.sol";
import "../oracle/Oracle.sol";
import '../interfaces/IKscswapFactory.sol';

/*
优化方向
1. 需要判断oracle价格获取失败的情况
2. 增加nft交易结束的状态
3. usdt可以更换地址，更换地址要重新授权
4. 计算盈余的usdt，增加提取入口
5. 增加交易的费率收益
*/

contract NftVault is Ownable, IERC721Receiver {
    using strings for *;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;

    enum NftStatus{
        trading,
        redeemed,
        end
    }

    struct NftInfo {
        address owner;
        address nftAddress;
        uint256 tokenId;
        string name;
        string description;
        address ntokenAddress;
        uint256 supply;
        uint256 redeemRatio;
        uint256 redeemAmount;
        uint256 redeemPrice;
        NftStatus status;
    }

    //strage the deposited nft
    NftInfo[] public nftInfo;

    //get NftInfo from ntoken address 
    mapping(address => uint256) public pidFromNtoken;

    //get deposite ntoken array from user address
    mapping(address => address[]) private ntokenListFromUser;

    //factory for create ntoken
    NtokenFactory public ntokenFactory;

    //oracle of dex
    Oracle public oracle;

    //usdt address
    address public usdt;

    event Deposit(address indexed user_, uint256 indexed pid_);
    event Redeem(address indexed user_, uint256 indexed pid_, uint256 redeemAmount_, uint256 usdtAmount_);
    event ExchangeU(address indexed user_, uint256 indexed pid_, uint256 redeemAmount_, uint256 usdtAmount_);

    constructor(address usdt_, address factory_, address oracle_) public {
        require(factory_ != address(0), "NftVault#constructor: invaild factory address");
        require(usdt_ != address(0), "NftVault#constructor: invaild usdt address");
        usdt = usdt_;
        ntokenFactory = NtokenFactory(factory_);
        oracle = Oracle(oracle_);
        IERC20(usdt).safeApprove(address(this), type(uint256).max);
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setNtokenFactory(address factory_) external onlyOwner {
        require(factory_ != address(0) && factory_ != address(ntokenFactory), 
            "NftVault#setNtokenFactory: invaild factory address");
        ntokenFactory = NtokenFactory(factory_);
    }

    function nftInfoLength() external view returns (uint256) {
        return nftInfo.length;
    }

    function deposit(
        address nft_, 
        uint256 tokenId_, 
        string memory name_, 
        string memory description_, 
        string memory ntokenName_, 
        uint256 supply_, 
        uint256 redeemRatio_
        ) external {
        require(!address(_msgSender()).isContract(), "NftVault#deposit: sender is a contract.");
        require(nft_ != address(0) && nft_.isContract(), "NftVault#deposit: invail nft address.");
        require(_msgSender() == IERC721(nft_).ownerOf(tokenId_), "NftVault#deposit: not owner of the nft.");
        require(supply_ > 0, "NftVault#redeem: ntoken supply is zero.");
        require(redeemRatio_ > supply_.mul(50).div(100) && redeemRatio_ < supply_, "NftVault#redeem: erro redeem amount.");
        
        //1. tansfer nft to vault
        IERC721(nft_).safeTransferFrom(_msgSender(), address(this), tokenId_);

        //2. creat ntoken
        // string memory ntokenName = name_.toSlice().concat("_".toSlice())
        //                                 .toSlice().concat(tokenId_.toString().toSlice())
        //                                 .toSlice().concat("_Ntoken".toSlice());
        address ntoken = ntokenFactory.createNtoken(ntokenName_, ntokenName_, supply_, _msgSender());

        //3. add nft to nftInfo
        nftInfo.push(
            NftInfo({
                owner: _msgSender(),
                nftAddress: nft_,
                tokenId: tokenId_,
                name: name_,
                description: description_,
                ntokenAddress: ntoken,
                supply: supply_,
                redeemRatio: redeemRatio_,
                redeemAmount: 0,
                redeemPrice: 0,
                status: NftStatus.trading
            })
        );
        pidFromNtoken[ntoken] = nftInfo.length - 1;

        ntokenListFromUser[_msgSender()].push(ntoken);

        emit Deposit(_msgSender(), pidFromNtoken[ntoken]);
    }

    function redeem(
        address ntoken_,
        uint256 ntokenAmount_,
        uint256 usdtAmount_
        ) external {
        require(ntoken_ != address(0) && ntoken_.isContract(), "NftVault#redeem: invail ntoken address.");
        require(ntokenAmount_ >0, "NftVault#redeem: ntoken amount is zero");
        uint256 pid = pidFromNtoken[ntoken_];
        NftInfo storage nft = nftInfo[pid];
        require(nft.status == NftStatus.trading, "NftVault#redeem: nft is redeemed.");

        //1. transfer ntoken to vault
        require(ntokenAmount_ >= nft.redeemRatio, "NftVault#redeem: the amount is not enough.");
        require(ntokenAmount_ <= IERC20(ntoken_).balanceOf(_msgSender()), "NftVault#redeem: the balance is not enough.");
        IERC20(ntoken_).safeTransferFrom(_msgSender(), address(this), ntokenAmount_);

        //2. computer ntoken price   add the error condition
        uint256 ntokenPrice = 0;
        if(IKscswapFactory(oracle.factory()).getPair(ntoken_, usdt) != address(0)){
            // ntokenPrice = oracle.consult(ntoken_, uint256(1e18), usdt);
            ntokenPrice = oracle.getCurrentPrice(ntoken_);
        }
        uint256 usdtAmount = nft.supply.sub(ntokenAmount_).mul(ntokenPrice).div(uint256(1e18));
        
        //3. transfer usdt to vault
        require(usdtAmount <= IERC20(usdt).balanceOf(_msgSender()) && usdtAmount <= usdtAmount_, "NftVault#redeem: the usdt is not enough.");
        IERC20(usdt).safeTransferFrom(_msgSender(), address(this), usdtAmount);
        
        //4. record redeem price/amount and change status
        nft.redeemAmount = ntokenAmount_;
        nft.redeemPrice = ntokenPrice;
        nft.status = NftStatus.redeemed;
        require(nft.redeemAmount <= nft.supply, "NftVault#redeem: redeem over.");

        //5. redeem nft(tranfer nft to sender)
        IERC721(nft.nftAddress).safeTransferFrom(address(this), _msgSender(), nft.tokenId);

        emit Redeem(_msgSender(), pid, ntokenAmount_, usdtAmount);
    }
    

    function exchangeToU(
        address ntoken_,
        uint256 ntokenAmount_
        ) external {
        require(ntoken_ != address(0) && ntoken_.isContract(), "NftVault#exchangeToU: invail ntoken address.");
        require(ntokenAmount_ >0, "NftVault#exchangeToU: ntoken amount is zero");
        uint256 pid = pidFromNtoken[ntoken_];
        NftInfo storage nft = nftInfo[pid];
        require(nft.status == NftStatus.redeemed, "NftVault#redeem: nft is trading.");
        
        //1. transfer ntoken to vault
        require(ntokenAmount_ <= IERC20(ntoken_).balanceOf(_msgSender()), "NftVault#exchangeToU: the balance is not enough.");
        IERC20(ntoken_).safeTransferFrom(_msgSender(), address(this), ntokenAmount_);

        //2. transfer usdt to sender
        uint256 usdtAmount = ntokenAmount_.mul(nft.redeemPrice).div(1e18);
        require(usdtAmount <= IERC20(usdt).balanceOf(address(this)), "NftVault#exchangeToU: the usdt is not enough.");
        IERC20(usdt).safeTransferFrom(address(this), _msgSender(), usdtAmount);

        //3. record redeem amount
        nft.redeemAmount = nft.redeemAmount + ntokenAmount_;
        require(nft.redeemAmount <= nft.supply, "NftVault#exchangeToU: redeem over.");

        emit ExchangeU(_msgSender(), pid, ntokenAmount_, usdtAmount);
    }

    function getDepositedNftList(address account) external view returns(uint256[] memory){
        address[] memory ntokenList = ntokenListFromUser[account];
        uint256[] memory index = new uint256[](ntokenList.length);
        for (uint256 i = 0; i < ntokenList.length; i++){
            index[i] = pidFromNtoken[ntokenList[i]];
        }
        return index;
    }

}
