pragma solidity ^0.8.0;

import "./NftVault.sol";

contract BatchProxy {
    NFTVault public vault;

    constructor(address _vault) {
        vault = NFTVault(_vault);
    }

    /// @notice Wrap multiple NFT in one tx
    /// @param _nfts Array of NFT contract address
    /// @param _tokenIds Array of NFT token ID
    function batchWrap(
        address[] memory _nfts,
        uint256[] memory _tokenIds
    ) external {
        require(_nfts.length == _tokenIds.length, "Mismatch arr length");

        for (uint256 index = 0; index < _nfts.length; index++) {
            address nft = _nfts[index];
            uint256 tokenId = _tokenIds[index];

            require(nft != address(0), "invalid nft address");
            IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
            IERC721(nft).approve(address(vault), tokenId);
            vault.wrap(nft, tokenId);
            uint256 wnftId = vault.wnftIds(nft);
            (, address wnft) = vault.wnfts(wnftId);
            IERC20(wnft).transfer(msg.sender, IERC20(wnft).balanceOf(address(this)));
        }
    }
}