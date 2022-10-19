pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MockERC20 is ERC20PresetMinterPauser {
    constructor(string memory name, string memory symbol) 
        ERC20PresetMinterPauser(name, symbol) {}
    
    function mint(address to, uint256 amount) public override virtual {
        _mint(to, amount);
    }

    function burnFrom(address account, uint256 amount) public override virtual {
        _burn(account, amount);
    }
}