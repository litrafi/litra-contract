// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "hardhat/console.sol";

import "../interfaces/INFTVaultV2.sol";
import "../interfaces/IWrappedWNFT.sol";
import "../interfaces/IBorrowRateModel.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract BorrowMinter is OwnableUpgradeable, ReentrancyGuardUpgradeable {

    event SetBorrowModel(address);
    event SetFeeReceiver(address);
    event SetLTV(uint);
    event SetLiquidationRewardRate(uint);
    event OpenPosition(uint indexed positionId, address indexed user, address nftAddr, uint[] tokenIds);
    event IncreasePosition(uint indexed positionId, uint borrowAmount, uint debtTokens);
    event DecreasePosition(uint indexed positionId, uint repayAmount, uint debtTokens);
    event ClosePosition(uint indexed positionId);
    event LiquidatePosition(uint indexed positionId, Position lastState);

    struct Position {
        address owner;
        address nftAddr;
        uint[] tokenIds;
        uint debtTokens;
        uint borrowed;
        uint paid;
    }

    INFTVaultV2 public vault;
    IBorrowRateModel public borrowRateModel;
    address public feeReceiver;

    uint public constant LTV_MULTIPLIER = 1e5;
    uint public constant LIQUIDATION_REWARD_RATE_MULTIPLIER = 1e5;
    uint public constant INTEREST_RATE_MULTIPLIER = 1e18;

    uint public ltv;
    uint public liquidationRewardRate;

    mapping(address => uint) public totalDebt;
    mapping(address => uint) public totalDebtTokens;
    mapping(address => uint) public lastDebtUpdate;
    Position[] public positions;

    function initialize(
        address vault_,
        address borrowRateModel_,
        address feeReceiver_,
        uint ltv_,
        uint liquidationRewardRate_
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        vault = INFTVaultV2(vault_);
        setBorrowRateModel(borrowRateModel_);
        setLTV(ltv_);
        setFeeReceiver(feeReceiver_);
        setLiquidationRewardRate(liquidationRewardRate_);
    }

    function setBorrowRateModel(address borrowRateModel_) public onlyOwner {
        borrowRateModel = IBorrowRateModel(borrowRateModel_);
        emit SetBorrowModel(borrowRateModel_);
    }

    function setFeeReceiver(address feeReceiver_) public onlyOwner {
        feeReceiver = feeReceiver_;
        emit SetFeeReceiver(feeReceiver_);
    }

    function setLTV(uint ltv_) public onlyOwner {
        ltv = ltv_;
        emit SetLTV(ltv_);
    }

    function setLiquidationRewardRate(uint liquidationRewardRate_) public onlyOwner {
        liquidationRewardRate = liquidationRewardRate_;
        emit SetLiquidationRewardRate(liquidationRewardRate_);
    }

    function debtTokensToAmount(
        address nftAddr_,
        uint debtTokens_
    ) public view returns(uint) {
        uint _totalDebtTokens = totalDebtTokens[nftAddr_];
        if(_totalDebtTokens == 0) {
            return debtTokens_;
        }
        return debtTokens_ * totalDebt[nftAddr_] / _totalDebtTokens;
    }

    function amountToDebtTokens(
        address nftAddr_,
        uint amount_
    ) public view returns(uint debtTokens) {
        uint _totalDebt = totalDebt[nftAddr_];
        if(_totalDebt == 0) {
            debtTokens = amount_;
        } else {
            debtTokens = amount_ * totalDebtTokens[nftAddr_] / _totalDebt;
        }
    }

    function positionInfo(uint positionId_) external view returns(Position memory pos) {
        pos = positions[positionId_];
    }

    function positionInfoWrite(uint positionId_) external returns(
        Position memory pos,
        uint currentDebt,
        bool isHealthy
    ) {
        pos = positions[positionId_];
        _addInterest(pos.nftAddr);
        currentDebt = debtTokensToAmount(pos.nftAddr, pos.debtTokens);
        isHealthy = _isPositionHealthy(positionId_);
    }

    function _addInterest(address nft_) internal {
        uint _lastDebtUpdate = lastDebtUpdate[nft_];
        if(_lastDebtUpdate != 0) {
            totalDebt[nft_] += borrowRateModel.borrowRate(nft_) 
                * (block.timestamp - _lastDebtUpdate)
                * totalDebt[nft_]
                / INTEREST_RATE_MULTIPLIER;
        }
        lastDebtUpdate[nft_] = block.timestamp;
    }

    function openPosition(
        address collaterNFT_,
        uint[] calldata tokenIds_,
        uint borrowAmount_
    ) external nonReentrant {
        _openPosition(collaterNFT_, tokenIds_, borrowAmount_);
    }

    function createWNFTAndOpenPosition(
        address collaterNFT_,
        string calldata nftName_,
        string calldata nftSymbol_,
        uint[] calldata tokenIds_,
        uint borrowAmount_
    ) external nonReentrant returns(address wNFT) {
        wNFT = vault.createWNFT(collaterNFT_, nftName_, nftSymbol_);
        _openPosition(collaterNFT_, tokenIds_, borrowAmount_);
    }

    function _openPosition(
        address collaterNFT_,
        uint[] calldata tokenIds_,
        uint borrowAmount_
    ) public {
        for (uint256 index = 0; index < tokenIds_.length; index++) {
            IERC721(collaterNFT_).transferFrom(msg.sender, address(this), tokenIds_[index]);
        }
        uint positionId = positions.length;
        positions.push(Position(msg.sender, collaterNFT_, tokenIds_, 0, 0, 0));
        emit OpenPosition(positionId, msg.sender, collaterNFT_, tokenIds_);
        _increasePosition(positionId, borrowAmount_);
    }

    function increasePosition(
        uint positionId_,
        uint borrowAmount_
    ) external nonReentrant {
        _increasePosition(positionId_, borrowAmount_);
    }

    function _increasePosition(
        uint positionId_,
        uint borrowAmount_
    ) internal {
        require(borrowAmount_ > 0, "Borrow amount must be greater than 0");
        Position memory pos = _getPosition(positionId_);
        require(msg.sender == pos.owner, "Only position owner can increase position");

        _addInterest(pos.nftAddr);

        uint debtTokens = amountToDebtTokens(pos.nftAddr, borrowAmount_);
        positions[positionId_].debtTokens += debtTokens;
        positions[positionId_].borrowed += borrowAmount_;
        totalDebtTokens[pos.nftAddr] += debtTokens;
        totalDebt[pos.nftAddr] += borrowAmount_;
        
        // mint wNFT
        vault.mintWNFT(pos.nftAddr, borrowAmount_, msg.sender);

        emit IncreasePosition(positionId_, borrowAmount_, debtTokens);
        require(_isPositionHealthy(positionId_), "Position is not healthy");
    }

    function decreasePosition(
        uint positionId_,
        uint debtTokens_
    ) external nonReentrant {
        Position memory position = _getPosition(positionId_);

        _addInterest(position.nftAddr);

        uint repayAmount = debtTokensToAmount(position.nftAddr, debtTokens_);
        require(repayAmount > 0, "Repay amount must be greater than 0");
        address wnft = vault.nftToWNFT(position.nftAddr);
        IWrappedWNFT(wnft).transferFrom(msg.sender, address(this), repayAmount);
        
        positions[positionId_].debtTokens -= debtTokens_;
        positions[positionId_].paid += repayAmount;
        totalDebtTokens[position.nftAddr] -= debtTokens_;
        totalDebt[position.nftAddr] -= repayAmount;

        emit DecreasePosition(positionId_, repayAmount, debtTokens_);
    }

    function closePosition(
        uint positionId_
    ) external nonReentrant {
        Position memory position = _getPosition(positionId_);

        _addInterest(position.nftAddr);

        require(msg.sender == position.owner, "Not position owner");
        require(position.debtTokens == 0, "Unpaid debt");
        IWrappedWNFT wnft = IWrappedWNFT(vault.nftToWNFT(position.nftAddr));
        wnft.burn(position.borrowed);
        if(position.paid > position.borrowed) {
            wnft.transfer(feeReceiver, position.paid - position.borrowed);
        }
        for(uint i = 0; i < position.tokenIds.length; i++) {
            IERC721(position.nftAddr).safeTransferFrom(address(this), position.owner, position.tokenIds[i], "");
        }
        delete positions[positionId_];
        emit ClosePosition(positionId_);
    }

    function liquidatePositon(
        uint positionId_
    ) external nonReentrant {
        Position memory pos = _getPosition(positionId_);

        _addInterest(pos.nftAddr);

        require(!_isPositionHealthy(positionId_), "Position is healthy");
        for (uint256 index = 0; index < pos.tokenIds.length; index++) {
            uint tokenId = pos.tokenIds[index];
            IERC721(pos.nftAddr).approve(address(vault), tokenId);
            vault.wrap(pos.nftAddr, tokenId);
        }
        // distribute liquidation reward
        IWrappedWNFT wNFT = IWrappedWNFT(vault.nftToWNFT(pos.nftAddr));
        uint wNFTAmount = pos.tokenIds.length * 1e18;
        uint reward = wNFTAmount * liquidationRewardRate / LIQUIDATION_REWARD_RATE_MULTIPLIER;
        wNFT.transfer(msg.sender, reward);
        // pay debt
        wNFTAmount -= reward;
        uint debtAmount = debtTokensToAmount(pos.nftAddr, pos.debtTokens);
        uint paid = debtAmount > wNFTAmount ? wNFTAmount : debtAmount;
        pos.paid += paid;
        wNFTAmount -= paid;
        if(wNFTAmount > 0) {
           wNFT.transfer(pos.owner, wNFTAmount);
        }
        // close position
        if(pos.paid > pos.borrowed) {
            wNFT.burn(pos.borrowed);
            wNFT.transfer(feeReceiver, pos.paid - pos.borrowed);
        } else {
            wNFT.burn(pos.paid);
        }
        delete positions[positionId_];
        
        emit LiquidatePosition(positionId_, pos);
    }

    function _getPosition(uint positionId_) internal view returns(Position memory pos){
        require(positionId_ < positions.length, "Position not found");
        pos = positions[positionId_];
        require(pos.nftAddr != address(0), "Closed position");
    }

    function _isPositionHealthy(uint positionId_) internal view returns(bool){
        Position memory pos = positions[positionId_];
        uint debtAmount = debtTokensToAmount(pos.nftAddr, pos.debtTokens);
        return debtAmount <= pos.tokenIds.length * 1e18 * ltv / LTV_MULTIPLIER;
    }
}