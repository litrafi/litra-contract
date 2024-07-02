// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./WrappedNFT.sol";
import "../utils/NftReceiver.sol";
import "../interfaces/IFeeManager.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract NFTVault is Initializable, ReentrancyGuardUpgradeable, NftReceiver, OwnableUpgradeable {
    event CreateWrappedNFT(address indexed nft, address wnft);
    event Wrap(address indexed wrapper, address nft, uint256 tokenId, uint256 fee);
    event Unwrap(address indexed unwrapper, address nft, uint256 tokenId);
    event SetMinter(address, bool);
    event SetFeeManager(address);
    event MintWNFT(address indexed nftAddr, address minter);

    using EnumerableSet for EnumerableSet.UintSet;

    mapping (address => bool) public isMinter;
    mapping (address => address) public nftToWNFT;
    mapping (address => mapping (uint => bool)) public wrapped;
    IFeeManager public feeManager;

    error WNFTNotExist(address nft);
    error WNFTAlreadyExist(address nft);
    error NotWrapped(address nft, uint tokenId);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Not minter");
        _;
    }

    function initialize(
        address owner_,
        address feeManager_
    ) external initializer {
        __ReentrancyGuard_init();
        _transferOwnership(owner_);
        setFeeManager(feeManager_);
    }

    function setMinter(
        address minter_,
        bool active_
    ) external onlyOwner {
        isMinter[minter_] = active_;
        emit SetMinter(minter_, active_);
    }

    function setFeeManager(
        address feeManager_
    ) public onlyOwner {
        feeManager = IFeeManager(feeManager_);
        emit SetFeeManager(feeManager_);
    }

    function createAndWrap(
        address nftAddr_,
        uint256 tokenId_,
        string calldata nftName_,
        string calldata nftSymbol_
    ) external {
        _createWNFT(nftAddr_, nftName_, nftSymbol_);
        wrap(nftAddr_, tokenId_);
    }

    /**
        @notice Wrap a NFT(IERC721) into a ERC20 token.
        @param nftAddr_ address of NFT contract
        @param tokenId_ token id of the NFT
     */
    function wrap (
        address nftAddr_,
        uint256 tokenId_
    ) public nonReentrant {
        IERC721(nftAddr_).transferFrom(msg.sender, address(this), tokenId_);
        address wnft = nftToWNFT[nftAddr_];
        if(wnft == address(0)) {
            revert WNFTNotExist(nftAddr_);
        }
        // mint and charge fee
        uint256 fee;
        if(address(feeManager) != address(0)) {
            fee = feeManager.wrapFee(wnft);
        }
        if(fee > 0) {
            WrappedNFT(wnft).mint(address(feeManager), fee);
        }
        WrappedNFT(wnft).mint(msg.sender, 1e18 - fee);
        wrapped[nftAddr_][tokenId_] = true;

        emit Wrap(msg.sender, nftAddr_, tokenId_, fee);
    }

    /**
        @notice Redeem nft from vault and burn one FT
        @param nftAddr_ address of NFT contract
        @param tokenId_ token id of the NFT
     */
    function unwrap(address nftAddr_, uint256 tokenId_) external payable nonReentrant {
        address wnft = nftToWNFT[nftAddr_];
        if(wnft == address(0)) {
            revert WNFTNotExist(nftAddr_);
        }
        if(!wrapped[nftAddr_][tokenId_]) {
            revert NotWrapped(nftAddr_, tokenId_);
        }
        // burn ft and charge fee
        uint256 fee;
        if(address(feeManager) != address(0)) {
            fee = feeManager.unwrapFee(wnft);
        }
        if(fee > 0) {
            WrappedNFT(wnft).transferFrom(msg.sender, address(feeManager), fee);
        }
        WrappedNFT(wnft).transferFrom(msg.sender, address(this), 1e18);
        WrappedNFT(wnft).burn(1e18);
        IERC721(nftAddr_).safeTransferFrom(address(this), msg.sender, tokenId_);
        wrapped[nftAddr_][tokenId_] = false;

        emit Unwrap(msg.sender, nftAddr_, tokenId_);
    }

    function mintWNFT(
        address nftAddr_,
        uint amount_,
        address receiver_
    ) public onlyMinter {
        address wnft = nftToWNFT[nftAddr_];
        if(wnft == address(0)) {
            revert WNFTNotExist(nftAddr_);
        }
        WrappedNFT(wnft).mint(receiver_, amount_);
        emit MintWNFT(msg.sender, nftAddr_);
    }

    function createWNFT(
        address nftAddr_,
        string calldata nftName_,
        string calldata nftSymbol_
    ) external onlyMinter returns(WrappedNFT wnft) {
        return _createWNFT(nftAddr_, nftName_, nftSymbol_);
    }

    function _createWNFT(
        address nftAddr_,
        string calldata nftName_,
        string calldata nftSymbol_
    ) internal returns(WrappedNFT wnft) {
        if(nftToWNFT[nftAddr_] != address(0)) {
            revert WNFTAlreadyExist(nftAddr_);
        }
        wnft = new WrappedNFT(nftName_, nftSymbol_);
        emit CreateWrappedNFT(nftAddr_, address(wnft));
    }
}
