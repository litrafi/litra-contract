pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

library TransferLib {
    enum NftType {
        E721,
        E1155
    }

    function transferFrom(address token, address from, address payable to, uint amount, uint value) internal returns(uint){
        if(token == address(0)) {
            require(value == amount, 'TrasferLib: failed! Wrong value');
            if(to != address(this)) {
                AddressUpgradeable.sendValue(to, amount);
            }
            return msg.value;
        } else {
            SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(token), from, to, amount);
            return amount;
        }
    }

    function transfer(address token, address payable to, uint amount) internal {
        if(token == address(0)) {
            AddressUpgradeable.sendValue(to, amount);
        } else {
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(token), to, amount);
        }
    }

    function nftTransferFrom(address nft, address from, address to, uint256 tokenId) internal {
        IERC165(nft).supportsInterface(type(IERC721).interfaceId);
        if(IERC165(nft).supportsInterface(type(IERC721).interfaceId)) {
            IERC721(nft).safeTransferFrom(from, to, tokenId);
        } else if(IERC165(nft).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(nft).safeTransferFrom(from, to, tokenId, 1, bytes(""));
        } else {
            require(false, "Invalid nft type");
        }
    }
}