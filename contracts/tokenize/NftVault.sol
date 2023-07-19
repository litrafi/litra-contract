// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WrappedNFT.sol";
import "../utils/NftReceiver.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IFeeManager.sol";
import "../dao/admin/OwnershipAdminManaged.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract NFTVault is ReentrancyGuard, NftReceiver, OwnershipAdminManaged {
    event CreateWrappedNFT(address indexed nft, uint256 wnftId, address wnft);
    event Wrap(address indexed creator, uint256 wnftId, uint256 nftId, uint256 receivedAmount);
    event Unwrap(address indexed redeemer, uint256 wnftId, uint256 nftId);

    using EnumerableSet for EnumerableSet.UintSet;

    // Record of NFT fungiblized
    struct WrappedNFTInfo {
        address nftAddr;
        uint256 tokenId;
        bool inVault;
    }

    // WNFT Info
    struct WNFTInfo {
        address nftAddr;
        address wnftAddr;
    }

    mapping(uint256 => WNFTInfo) public wnfts;
    uint256 public nextWnftId = 1;
    // nft addr => wnftId
    mapping(address => uint256) public wnftIds;
    // wnft addr => wnftId
    mapping(address => uint256) public wnftAddrToId;
    WrappedNFTInfo[] public wrappedNfts;
    mapping(uint256 => EnumerableSet.UintSet) private _nfts;
    IFeeManager public feeManager;
    // NFT address => strategy address
    mapping(address => address) public strategies;

    constructor() OwnershipAdminManaged(msg.sender) ReentrancyGuard() {}

    function setFeeManager(IFeeManager _feeManager) external onlyOwnershipAdmin {
        feeManager = _feeManager;
    }

    function setStrategy(address _nft, address _strategy) external onlyOwnershipAdmin {
        address strategy = strategies[_nft];
        if(strategy != address(0)) {
            IERC721(_nft).setApprovalForAll(strategy, false);
            IStrategy(strategy).kill();
        }
        IERC721(_nft).setApprovalForAll(_strategy, true);
        strategies[_nft] = _strategy;
    }

    /**
        @notice Wrap a NFT(IERC721) into a ERC20 token.
        @param _nftAddr address of NFT contract
        @param _tokenId token id of the NFT
     */
    function wrap (
        address _nftAddr,
        uint256 _tokenId
    ) external payable nonReentrant returns(address wnft){
        IERC721(_nftAddr).transferFrom(msg.sender, address(this), _tokenId);
        // Save nft record
        uint256 recordId = wrappedNfts.length;
        wrappedNfts.push(WrappedNFTInfo(_nftAddr, _tokenId, true));
        // Get FT Info
        uint256 wnftId = wnftIds[_nftAddr];
        if(wnftId == 0) {
            // Create a new FT
            string memory wnftName;
            string memory wnftSymbol;
            (bool succeed, bytes memory result) = _nftAddr.call(abi.encodeWithSignature("name()"));
            if(succeed) {
                string memory nftName = abi.decode(result, (string));
                wnftName = string(abi.encodePacked(nftName, " Wrapped NFT"));
            } else {
                wnftName = string(abi.encodePacked("Litra FT#", wnftId));
            }
            (succeed, result) = _nftAddr.call(abi.encodeWithSignature("symbol()"));
            if(succeed) {
                string memory nftSymbol = abi.decode(result, (string));
                wnftSymbol = string(abi.encodePacked(nftSymbol, "wnft"));
            } else {
                wnftSymbol = string(abi.encodePacked("LWNFT#", wnftId));
            }
            wnft = address(new WrappedNFT(wnftName, wnftSymbol));
            // get ftId
            uint256 _nextWnftId = nextWnftId;
            wnftId = _nextWnftId;
            _nextWnftId ++;
            nextWnftId = _nextWnftId;
            // storage
            wnfts[wnftId] = WNFTInfo(_nftAddr, wnft);
            wnftIds[_nftAddr] = wnftId;
            wnftAddrToId[wnft] = wnftId;
            
            emit CreateWrappedNFT(_nftAddr, wnftId, wnft);
        } else {
            wnft = wnfts[wnftId].wnftAddr;
        }
        // bound FT and NFT
        require(_nfts[wnftId].add(recordId));
        // mint and charge fee
        uint256 fee;
        if(address(feeManager) != address(0)) {
            fee = feeManager.wrapFee(wnft);
        }
        if(fee > 0) {
            WrappedNFT(wnft).mint(address(feeManager), fee);
        }
        uint256 receivedAmount = 1e18 - fee;
        WrappedNFT(wnft).mint(msg.sender, receivedAmount);

        emit Wrap(msg.sender, wnftId, recordId, receivedAmount);
    }

    function nftsLength() external view returns(uint256) {
        return wrappedNfts.length;
    }

    /**
        @notice Get all NFTs in a series
        @param _wnftId id of WrappedNFT
     */
    function nftsInWnft(uint256 _wnftId) external view returns(uint256[] memory) {
        uint256 arrLength = _nfts[_wnftId].length();
        uint256[] memory nfts = new uint256[](arrLength);
        for (uint256 index = 0; index < arrLength; index++) {
            nfts[index] = _nfts[_wnftId].at(index);
        }
        return nfts;
    }

    /**
        @notice Redeem nft from vault and burn one FT
        @param _wnftId index of fts
        @param _nftId Greate than or equal 0 to redeem a designated nft with a more fees
                        Less than 0 to redeem a recent fungiblized nft with a normal fee
     */
    function unwrap(uint256 _wnftId, uint256 _nftId) external payable nonReentrant {
        WNFTInfo memory ftInfo = wnfts[_wnftId];
        require(ftInfo.nftAddr != address(0), "Invalid FT");
        require(WrappedNFT(ftInfo.wnftAddr).balanceOf(msg.sender) >= 1e18, "Insufficient ft");
        require(_nfts[_wnftId].length() > 0, "No NFT in vault");
        require(_nfts[_wnftId].contains(uint256(_nftId)), "Invalid nftId");
        // burn ft and charge fee
        uint256 fee;
        if(address(feeManager) != address(0)) {
            fee = feeManager.unwrapFee(ftInfo.wnftAddr);
        }
        if(fee > 0) {
            WrappedNFT(ftInfo.wnftAddr).transferFrom(msg.sender, address(feeManager), fee);
        }
        WrappedNFT(ftInfo.wnftAddr).transferFrom(msg.sender, address(this), 1e18);
        WrappedNFT(ftInfo.wnftAddr).burn(1e18);
        // return nft
        WrappedNFTInfo memory nftInfo = wrappedNfts[_nftId];
        wrappedNfts[_nftId].inVault = false;
        _nfts[_wnftId].remove(_nftId);
        if(IERC721(nftInfo.nftAddr).ownerOf(nftInfo.tokenId) == address(this)) {
            IERC721(nftInfo.nftAddr).safeTransferFrom(address(this), msg.sender, nftInfo.tokenId);
        } else {
            address strategy = strategies[nftInfo.nftAddr];
            require(IERC721(nftInfo.nftAddr).ownerOf(nftInfo.tokenId) == strategy, "Not in vault");
            IStrategy(strategy).redeem(nftInfo.nftAddr, nftInfo.tokenId, msg.sender);
        }

        emit Unwrap(msg.sender, _wnftId, _nftId);
    }
}
