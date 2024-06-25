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

    using EnumerableSet for EnumerableSet.UintSet;

    mapping (address => address) public nftToWNFT;
    mapping (address => mapping (uint => bool)) public wrapped;
    IFeeManager public feeManager;

    error WNFTNotExist(address nft);
    error WNFTAlreadyExist(address nft);
    error NotWrapped(address nft, uint tokenId);

    function initialize(
        address _owner,
        IFeeManager _feeManager
    ) external initializer {
        __ReentrancyGuard_init();
        _transferOwnership(_owner);
        feeManager = _feeManager;
    }

    function createAndWrap(
        address _nftAddr,
        uint256 _tokenId,
        string memory _nftName,
        string memory _nftSymbol
    ) external {
        _createWNFT(_nftAddr, _nftName, _nftSymbol);
        wrap(_nftAddr, _tokenId);
    }

    /**
        @notice Wrap a NFT(IERC721) into a ERC20 token.
        @param _nftAddr address of NFT contract
        @param _tokenId token id of the NFT
     */
    function wrap (
        address _nftAddr,
        uint256 _tokenId
    ) public payable nonReentrant {
        IERC721(_nftAddr).transferFrom(msg.sender, address(this), _tokenId);
        address wnft = nftToWNFT[_nftAddr];
        if(wnft == address(0)) {
            revert WNFTNotExist(_nftAddr);
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
        wrapped[_nftAddr][_tokenId] = true;

        emit Wrap(msg.sender, _nftAddr, _tokenId, fee);
    }

    /**
        @notice Redeem nft from vault and burn one FT
        @param _nftAddr address of NFT contract
        @param _tokenId token id of the NFT
     */
    function unwrap(address _nftAddr, uint256 _tokenId) external payable nonReentrant {
        address wnft = nftToWNFT[_nftAddr];
        if(wnft == address(0)) {
            revert WNFTNotExist(_nftAddr);
        }
        if(!wrapped[_nftAddr][_tokenId]) {
            revert NotWrapped(_nftAddr, _tokenId);
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
        IERC721(_nftAddr).safeTransferFrom(address(this), msg.sender, _tokenId);
        wrapped[_nftAddr][_tokenId] = false;

        emit Unwrap(msg.sender, _nftAddr, _tokenId);
    }

    function _createWNFT(
        address _nftAddr,
        string memory _nftName,
        string memory _nftSymbol
    ) internal {
        if(nftToWNFT[_nftAddr] != address(0)) {
            revert WNFTAlreadyExist(_nftAddr);
        }
        WrappedNFT wnft = new WrappedNFT(_nftName, _nftSymbol);
        emit CreateWrappedNFT(_nftAddr, address(wnft));
    }
}
