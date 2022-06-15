pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

library TransferLib {
    function transferFrom(address token, address from, address payable to, uint amount, uint value) internal returns(uint){
        if(token == address(0)) {
            require(value == amount, 'TrasferLib: failed! Wrong value');
            if(to != address(this)) {
                AddressUpgradeable.sendValue(to, amount);
            }
            return msg.value;
        } else {
            IERC20(token).transferFrom(from, to, amount);
            return amount;
        }
    }

    function transfer(address token, address payable to, uint amount) internal {
        if(token == address(0)) {
            AddressUpgradeable.sendValue(to, amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}