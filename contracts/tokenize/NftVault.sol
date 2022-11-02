// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./FToken.sol";
import "../utils/NftReceiver.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract NftVault is Ownable, ReentrancyGuard, NftReceiver {
    event CreateFToken(address indexed nft, uint256 ftId, address ft);
    event Fungiblize(address indexed creator, uint256 ftId, uint256 nftId);
    event Redeem(address indexed redeemer, uint256 ftId, uint256 nftId);

    using EnumerableSet for EnumerableSet.UintSet;

    // Record of NFT fungiblized
    struct FungiblizedNFT {
        address nftAddr;
        uint256 tokenId;
        bool inVault;
    }

    // Fungible Token
    struct FTInfo {
        address nftAddr;
        address ftAddr;
    }

    mapping(uint256 => FTInfo) public fts;
    uint256 public nextFtId = 1;
    // [nftAdd/ftAddr] => ftId
    mapping(address => uint256) public ftIds;
    FungiblizedNFT[] public fungiblizedNFTs;
    mapping(uint256 => EnumerableSet.UintSet) private _ftNfts;

    constructor() Ownable() ReentrancyGuard()  {}

    function fungiblize (
        address _nftAddr,
        uint256 _tokenId
    ) external nonReentrant {
        IERC721(_nftAddr).transferFrom(msg.sender, address(this), _tokenId);
        // Save nft record
        uint256 recordId = fungiblizedNFTs.length;
        fungiblizedNFTs.push(FungiblizedNFT(_nftAddr, _tokenId, true));
        // Get FT Info
        uint256 ftId = ftIds[_nftAddr];
        address ft;
        if(ftId == 0) {
            // Create a new FT
            string memory ftName;
            string memory ftSymbol;
            (bool succeed, bytes memory result) = _nftAddr.call(abi.encodeWithSignature("name()"));
            if(succeed) {
                string memory nftName = abi.decode(result, (string));
                ftName = string(abi.encodePacked(nftName, " Fungible Token"));
            } else {
                ftName = string(abi.encodePacked("Litra FT#", ftId));
            }
            (succeed, result) = _nftAddr.call(abi.encodeWithSignature("symbol()"));
            if(succeed) {
                string memory nftSymbol = abi.decode(result, (string));
                ftSymbol = string(abi.encodePacked(nftSymbol, "ft"));
            } else {
                ftSymbol = string(abi.encodePacked("LFT#", ftId));
            }
            ft = address(new FToken(ftName, ftSymbol));
            // get ftId
            uint256 _nextFtId = nextFtId;
            ftId = _nextFtId;
            _nextFtId ++;
            nextFtId = _nextFtId;
            // storage
            fts[ftId] = FTInfo(_nftAddr, ft);
            ftIds[_nftAddr] = ftId;
            ftIds[ft] = ftId;
            
            emit CreateFToken(_nftAddr, ftId, ft);
        } else {
            ft = fts[ftId].ftAddr;
        }
        // bound FT and NFT
        _ftNfts[ftId].add(recordId);
        // mint for user
        FToken(ft).mint(msg.sender, 1e18);

        emit Fungiblize(msg.sender, ftId, recordId);
    }

    function nftsLength() external view returns(uint256) {
        return fungiblizedNFTs.length;
    }

    function nftsInFt(uint256 _ftId) external view returns(uint256[] memory) {
        uint256 arrLength = _ftNfts[_ftId].length();
        uint256[] memory nfts = new uint256[](arrLength);
        for (uint256 index = 0; index < arrLength; index++) {
            nfts[index] = _ftNfts[_ftId].at(index);
        }
        return nfts;
    }

    /**
        @notice Redeem nft from vault and burn one FT
        @param _ftId index of fts
        @param _nftId Greate than or equal 0 to redeem a designated nft with a more fees
                        Less than 0 to redeem a recent fungiblized nft with a normal fee
     */
    function redeem(uint256 _ftId, int256 _nftId) external {
        FTInfo memory ftInfo = fts[_ftId];
        require(ftInfo.nftAddr != address(0), "Invalid FT");
        require(FToken(ftInfo.ftAddr).balanceOf(msg.sender) >= 1e18, "Insufficient ft");
        require(_ftNfts[_ftId].length() > 0, "No NFT in vault");
        require(_nftId < 0 || _ftNfts[_ftId].contains(uint256(_nftId)), "Invalid nftId");
        // burn ft
        FToken(ftInfo.ftAddr).burn(msg.sender, 1e18);
        // return nft
        uint256 returnedNftId;
        if(_nftId < 0) {
            // return the recent fungiblized nft
            returnedNftId = _ftNfts[_ftId].at(_ftNfts[_ftId].length() - 1);
        } else {
            returnedNftId = uint256(_nftId);
        }
        FungiblizedNFT memory nftInfo = fungiblizedNFTs[returnedNftId];
        fungiblizedNFTs[returnedNftId].inVault = false;
        _ftNfts[_ftId].remove(returnedNftId);
        IERC721(nftInfo.nftAddr).safeTransferFrom(address(this), msg.sender, nftInfo.tokenId);

        emit Redeem(msg.sender, _ftId, returnedNftId);
    }
}
