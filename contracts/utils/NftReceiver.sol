pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";

contract NftReceiver is IERC721Receiver {
     function onERC721Received(address, address, uint256, bytes memory) external virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}