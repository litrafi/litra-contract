// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NtokenFactory.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";

/*
优化方向
1. 需要判断oracle价格获取失败的情况
2. 增加nft交易结束的状态
3. eth可以更换地址，更换地址要重新授权
4. 计算盈余的eth，增加提取入口
5. 增加交易的费率收益
*/

contract NftVault is Initializable, IERC721ReceiverUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

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

    event Deposit(address indexed user_, uint256 indexed pid_);
    event Redeem(address indexed user_, uint256 indexed pid_, uint256 redeemAmount_, uint256 ethAmount_);
    event ExchangeU(address indexed user_, uint256 indexed pid_, uint256 redeemAmount_, uint256 ethAmount_);

    function initialize(address factory_) public initializer {
        require(factory_ != address(0), "NftVault#constructor: invaild factory address");

        __Ownable_init();
        __ReentrancyGuard_init();

        ntokenFactory = NtokenFactory(factory_);
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
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
        uint256 ntokenAmount_
    ) payable external {
        require(ntoken_ != address(0) && ntoken_.isContract(), "NftVault#redeem: invail ntoken address.");
        require(ntokenAmount_ >0, "NftVault#redeem: ntoken amount is zero");
        uint256 pid = pidFromNtoken[ntoken_];
        NftInfo storage nft = nftInfo[pid];
        require(nft.status == NftStatus.trading, "NftVault#redeem: nft is redeemed.");

        //1. transfer ntoken to vault
        require(ntokenAmount_ >= nft.redeemRatio, "NftVault#redeem: the amount is not enough.");
        require(ntokenAmount_ <= IERC20(ntoken_).balanceOf(_msgSender()), "NftVault#redeem: the balance is not enough.");
        IERC20Upgradeable(ntoken_).safeTransferFrom(_msgSender(), address(this), ntokenAmount_);

        //2. computer ntoken price   add the error condition
        uint256 ntokenPrice = 0;
        // if(IKscswapFactory(oracle.factory()).getPair(ntoken_, eth) != address(0)){
        //     // ntokenPrice = oracle.consult(ntoken_, uint256(1e18), eth);
        //     ntokenPrice = oracle.getCurrentPrice(ntoken_);
        // }
        uint256 ethAmount = nft.supply.sub(ntokenAmount_).mul(ntokenPrice).div(uint256(1e18));
        //3. transfer eth to vault
        require(ethAmount == msg.value, "NftVault#redeem: the eth is not enough.");
        
        //4. record redeem price/amount and change status
        nft.redeemAmount = ntokenAmount_;
        nft.redeemPrice = ntokenPrice;
        nft.status = NftStatus.redeemed;
        require(nft.redeemAmount <= nft.supply, "NftVault#redeem: redeem over.");

        //5. redeem nft(tranfer nft to sender)
        IERC721(nft.nftAddress).safeTransferFrom(address(this), _msgSender(), nft.tokenId);

        emit Redeem(_msgSender(), pid, ntokenAmount_, ethAmount);
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
        IERC20Upgradeable(ntoken_).safeTransferFrom(_msgSender(), address(this), ntokenAmount_);

        //2. transfer eth to sender
        uint256 ethAmount = ntokenAmount_.mul(nft.redeemPrice).div(1e18);
        require(ethAmount <= address(this).balance, "NftVault#exchangeToU: the eth is not enough.");
        require(payable(msg.sender).send(ethAmount), "NftVault#exchangeToU: sending failed");

        //3. record redeem amount
        nft.redeemAmount = nft.redeemAmount + ntokenAmount_;
        require(nft.redeemAmount <= nft.supply, "NftVault#exchangeToU: redeem over.");

        emit ExchangeU(_msgSender(), pid, ntokenAmount_, ethAmount);
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
