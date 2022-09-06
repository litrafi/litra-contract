// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NtokenFactory.sol";
import "../NtokenPricer.sol";
import "../utils/NftReceiver.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract NftVault is OwnableUpgradeable, ReentrancyGuardUpgradeable, NftReceiver {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    enum NftStatus{
        TRADING,
        REDEEMED,
        END
    }

    struct NftInfo {
        address owner;
        address[] nftAddress;
        uint256[] tokenId;
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
    mapping(uint256 => NftInfo) public nftInfo;

    uint256 private _nextTnftId;

    //get NftInfo from ntoken address 
    mapping(address => uint256) public pidFromNtoken;

    //get deposite ntoken array from user address
    mapping(address => address[]) private ntokenListFromUser;

    //factory for create ntoken
    NtokenFactory public ntokenFactory;

    // Pricer for getting ntoken price
    NtokenPricer public ntokenPricer;

    PublicConfig public config;

    event Deposit(address indexed user_, uint256 indexed pid_);
    event Redeem(address indexed user_, uint256 indexed pid_, uint256 redeemAmount_, uint256 ethAmount_);
    event CollectNtokens(address indexed user_, uint256 indexed pid_, uint256 redeemAmount_, uint256 ethAmount_);

    function initialize(
        NtokenFactory factory_,
        NtokenPricer ntokenPricer_,
        PublicConfig config_
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        ntokenFactory = factory_;
        ntokenPricer = ntokenPricer_;
        config = config_;
        _nextTnftId = 1;
    }

    function isTnftActive(address _tnft) external view returns(bool) {
        NftInfo memory nft = nftInfo[pidFromNtoken[_tnft]];
        return nft.supply > 0 && nft.status == NftStatus.TRADING;
    }

    function getUserCollection(address user) external view returns(uint256 totalValuation, uint256[] memory tnftIds) {
        bool[] memory owned = new bool[](_nextTnftId);
        uint256 totalOwned = 0;
        for (uint256 index = 1; index < _nextTnftId; index++) {
            address tnft = nftInfo[index].ntokenAddress;
            uint256 balance = Ntoken(tnft).balanceOf(user);
            if(balance > 0) {
                (,, uint256 price) = ntokenPricer.getTnftPrice(tnft);
                totalValuation = totalValuation.add(price.mul(balance).div(1e18));
                totalOwned ++;
                owned[index] = true;
            }
        }
        
        tnftIds = new uint256[](totalOwned);
        uint256 cursor = 0;
        for (uint256 index = 1; index < _nextTnftId; index++) {
            if(owned[index] == true) {
                tnftIds[cursor] = index;
                cursor ++;
            }
        }
    }

    function nftInfoLength() external view returns (uint256) {
        return _nextTnftId;
    }

    function nfts(uint256 tnftId) external view returns(address[] memory nftAddress, uint256[] memory tokenId) {
        return (nftInfo[tnftId].nftAddress, nftInfo[tnftId].tokenId);
    }

    function deposit(
        address[] calldata nfts_,
        uint256[] calldata tokenId_,
        string memory name_,
        string memory description_,
        string memory ntokenName_,
        uint256 supply_,
        uint256 redeemRatio_
    ) external {
        require(!address(_msgSender()).isContract(), "sender is a contract.");
        require(nfts_.length > 0, "empty nft array");
        require(supply_ > 0, "ntoken supply is zero.");
        require(redeemRatio_ > supply_.mul(50).div(100) && redeemRatio_ <= supply_, "erro redeem amount.");
        require(nfts_.length == tokenId_.length, "Invalid nfts");
        //1. tansfer nft to vault
        for (uint256 index = 0; index < nfts_.length; index++) {
            address nft = nfts_[index];
            require(nft != address(0) && nft.isContract(), "invail nft address.");
            TransferLib.nftTransferFrom(nft, _msgSender(), address(this), tokenId_[index]);
        }

        //2. creat ntoken
        // string memory ntokenName = name_.toSlice().concat("_".toSlice())
        //                                 .toSlice().concat(tokenId_.toString().toSlice())
        //                                 .toSlice().concat("_Ntoken".toSlice());
        address ntoken = ntokenFactory.createNtoken(ntokenName_, ntokenName_, supply_, _msgSender());

        //3. add nft to nftInfo
        nftInfo[_nextTnftId] = NftInfo({
            owner: _msgSender(),
            nftAddress: nfts_,
            tokenId: tokenId_,
            name: name_,
            description: description_,
            ntokenAddress: ntoken,
            supply: supply_,
            redeemRatio: redeemRatio_,
            redeemAmount: 0,
            redeemPrice: 0,
            status: NftStatus.TRADING
        });
        pidFromNtoken[ntoken] = _nextTnftId;
        _nextTnftId ++;

        ntokenListFromUser[_msgSender()].push(ntoken);
        emit Deposit(_msgSender(), pidFromNtoken[ntoken]);
    }

    function redeem(
        address ntoken_,
        uint256 ntokenAmount_
    ) external {
        require(ntoken_ != address(0) && ntoken_.isContract(), "NftVault#redeem: invail ntoken address.");
        require(ntokenAmount_ >0, "NftVault#redeem: ntoken amount is zero");
        uint256 pid = pidFromNtoken[ntoken_];
        require(pid != 0, "Invalid tnft");
        NftInfo storage nft = nftInfo[pid];
        require(nft.status == NftStatus.TRADING, "NftVault#redeem: nft is redeemed.");

        //1. transfer ntoken to vault
        require(ntokenAmount_ >= nft.redeemRatio, "NftVault#redeem: the amount is not enough.");
        require(ntokenAmount_ <= IERC20(ntoken_).balanceOf(_msgSender()), "NftVault#redeem: the balance is not enough.");
        IERC20Upgradeable(ntoken_).safeTransferFrom(_msgSender(), address(this), ntokenAmount_);

        //2. calculate ntoken price
        (, , uint256 ntokenPrice) = ntokenPricer.getTnftPrice(ntoken_);
        uint256 tokenAmount = nft.supply.sub(ntokenAmount_).mul(ntokenPrice).div(uint256(1e18));
        //3. transfer pricing token to vault
        IERC20(config.usdt()).transferFrom(_msgSender(), address(this), tokenAmount);
        
        //4. record redeem price/amount and change status
        nft.redeemAmount = ntokenAmount_;
        nft.redeemPrice = ntokenPrice;
        nft.status = NftStatus.REDEEMED;
        require(nft.redeemAmount <= nft.supply, "NftVault#redeem: redeem over.");

        //5. redeem nft(tranfer nft to sender)
        for (uint256 index = 0; index < nft.nftAddress.length; index++) {
            TransferLib.nftTransferFrom(nft.nftAddress[index], address(this), _msgSender(), nft.tokenId[index]);   
        }

        emit Redeem(_msgSender(), pid, ntokenAmount_, tokenAmount);
    }
    

    function collectNtokens(
        address ntoken_,
        uint256 ntokenAmount_
    ) external nonReentrant {
        require(ntoken_ != address(0) && ntoken_.isContract(), "NftVault#collectNtokens: invail ntoken address.");
        require(ntokenAmount_ >0, "NftVault#collectNtokens: ntoken amount is zero");
        uint256 pid = pidFromNtoken[ntoken_];
        require(pid != 0, "Invalid tnft");
        NftInfo storage nft = nftInfo[pid];
        require(nft.status == NftStatus.REDEEMED, "NftVault#redeem: nft is trading.");
        
        //1. transfer ntoken to vault
        require(ntokenAmount_ <= IERC20(ntoken_).balanceOf(_msgSender()), "NftVault#collectNtokens: the balance is not enough.");
        IERC20Upgradeable(ntoken_).safeTransferFrom(_msgSender(), address(this), ntokenAmount_);

        //2. transfer pricing token to sender
        uint256 tokenAmount = ntokenAmount_.mul(nft.redeemPrice).div(1e18);
        IERC20(config.usdt()).transfer(_msgSender(), tokenAmount);

        //3. record redeem amount
        nft.redeemAmount = nft.redeemAmount + ntokenAmount_;
        require(nft.redeemAmount <= nft.supply, "NftVault#collectNtokens: redeem over.");
        if(nft.redeemAmount == nft.supply) {
            nft.status = NftStatus.END;
        }

        emit CollectNtokens(_msgSender(), pid, ntokenAmount_, tokenAmount);
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
