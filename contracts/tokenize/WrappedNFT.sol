// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract WrappedNFT is ERC20Permit {
    address public creator;

    constructor(string memory _name, string memory _symbol) ERC20Permit(_name) ERC20(_name, _symbol) {
        creator = msg.sender;
    }

    function mint(address _for, uint256 _amount) external {
        require(creator == msg.sender, "!creator");
        _mint(_for, _amount);
    }

    function burn(address _account, uint256 _amount) external {
        require(creator == msg.sender, "!creator");
        _burn(_account, _amount);
    }
}
