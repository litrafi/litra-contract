pragma solidity =0.7.6;

import "@openzeppelin/contracts/presets/ERC721PresetMinterPauserAutoId.sol";

contract Nft is ERC721PresetMinterPauserAutoId {
    constructor(string memory name_, string memory symbol_, string memory baseTokenURI)
     ERC721PresetMinterPauserAutoId(name_, symbol_, baseTokenURI){}
}