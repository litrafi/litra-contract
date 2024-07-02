pragma solidity ^0.8.7;

interface INFTVaultV2 {
    function mintWNFT(
        address nftAddr_,
        uint amount_,
        address receiver_
    ) external;

    function createWNFT(
        address nftAddr_,
        string memory nftName_,
        string memory nftSymbol_
    ) external returns(address);

    function wrap (
        address nftAddr_,
        uint256 tokenId_
    ) external;

    function nftToWNFT(address) external view returns(address);
}