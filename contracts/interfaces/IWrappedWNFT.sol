pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWrappedWNFT is IERC20 {
    function mint(address _for, uint256 _amount) external;

    function burn(uint256 _amount) external;
}