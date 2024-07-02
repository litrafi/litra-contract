// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/INFTVaultV2.sol";
import "../interfaces/IWrappedWNFT.sol";
import "../interfaces/IBorrowRateModel.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BorrowMinter is OwnableUpgradeable {

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
    Position[] public positions;

    function initialize(address vault_) public initializer {
        __Ownable_init();
        vault = INFTVaultV2(vault_);
    }

    function setBorrowRateModel(address borrowRateModel_) public onlyOwner {
        borrowRateModel = IBorrowRateModel(borrowRateModel_);
    }

    function setLTV(uint ltv_) public onlyOwner {
        ltv = ltv_;
    }

    function debtTokensToAmount(
        address nftAddr_,
        uint debtTokens_
    ) public view returns(uint) {
        return debtTokens_ * totalDebt[nftAddr_] / totalDebtTokens[nftAddr_];
    }

    function amountToDebtTokens(
        address nftAddr_,
        uint amount_
    ) public view returns(uint debtTokens) {
        uint _totalDebtTokens = totalDebtTokens[nftAddr_];
        if(_totalDebtTokens == 0) {
            debtTokens = amount_;
        } else {
            debtTokens = amount_ * _totalDebtTokens / totalDebt[nftAddr_];
        }
    }

    function openPosition(
        address collaterNFT_,
        uint[] calldata tokenIds_,
        uint borrowAmount_
    ) public {
        require(borrowAmount_ > 0, "Borrow amount must be greater than 0");
        require(borrowAmount_ < 1e18 * tokenIds_.length * ltv / LTV_MULTIPLIER, "borrow too much");
        for (uint256 index = 0; index < tokenIds_.length; index++) {
            IERC721(collaterNFT_).transferFrom(msg.sender, address(this), tokenIds_[index]);
        }
        uint positionId = positions.length;
        positions.push(Position(msg.sender, collaterNFT_, tokenIds_, 0, 0, 0));
        emit OpenPosition(positionId, msg.sender, collaterNFT_, tokenIds_);
        increasePosition(positionId, borrowAmount_);
    }

    function createWNFTAndOpenPosition(
        address collaterNFT_,
        string calldata nftName_,
        string calldata nftSymbol_,
        uint[] calldata tokenIds_,
        uint borrowAmount_
    ) external returns(address wNFT) {
        wNFT = vault.createWNFT(collaterNFT_, nftName_, nftSymbol_);
        openPosition(collaterNFT_, tokenIds_, borrowAmount_);
    }

    function increasePosition(
        uint positionId_,
        uint borrowAmount_
    ) public {
        require(borrowAmount_ > 0, "Borrow amount must be greater than 0");
        Position memory pos = _getPosition(positionId_);
        require(msg.sender == pos.owner, "Only position owner can increase position");
        uint debtTokens = amountToDebtTokens(pos.nftAddr, borrowAmount_);
        positions[positionId_].debtTokens += debtTokens;
        positions[positionId_].borrowed += borrowAmount_;
        
        // mint wNFT
        vault.mintWNFT(pos.nftAddr, borrowAmount_, msg.sender);

        emit IncreasePosition(positionId_, borrowAmount_, debtTokens);
        require(_isPositionHealthy(positionId_), "Position is not healthy");
    }

    function decreasePosition(
        uint positionId_,
        uint debtTokens_
    ) external {
        Position memory position = _getPosition(positionId_);
        uint repayAmount = amountToDebtTokens(position.nftAddr, debtTokens_);
        require(repayAmount > 0, "Repay amount must be greater than 0");
        address wnft = vault.nftToWNFT(position.nftAddr);
        IWrappedWNFT(wnft).transferFrom(msg.sender, address(this), repayAmount);
        
        positions[positionId_].debtTokens -= debtTokens_;
        positions[positionId_].paid += repayAmount;

        emit DecreasePosition(positionId_, repayAmount, debtTokens_);
    }

    function closePosition(
        uint positionId_
    ) external {
        Position memory position = _getPosition(positionId_);
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
    ) external {
        Position memory pos = _getPosition(positionId_);
        require(!_isPositionHealthy(positionId_), "Position is healthy");
        for (uint256 index = 0; index < pos.tokenIds.length; index++) {
            vault.wrap(pos.nftAddr, pos.tokenIds[index]);
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