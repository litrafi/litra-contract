// SPDX-License-Identifier: MIT
pragma solidity =0.6.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./Ntoken.sol";

contract NtokenFactory {

    event NtokenCreated(address indexed ntoken_, address indexed to_, uint256 supply_);

    constructor() public {
    }

    function ntokenCodeHash() external pure returns (bytes32) {
        return keccak256(abi.encodePacked(type(Ntoken).creationCode));
    }
    
    function createNtoken(string memory name_, string memory symbol_, uint256 supply_, address to_) external returns (address ntoken) {
        
        bytes memory bytecode = constructorByteCode(name_, symbol_, supply_, to_);
        bytes32 salt = keccak256(abi.encodePacked(name_, symbol_, supply_, to_));
        // assembly {
        //     ntoken := create2(0, add(bytecode, 32), mload(bytecode), salt)
        // }
        // require(ntoken != address(0), "Create2: Failed on deploy");
        ntoken = Create2.deploy(0, salt, bytecode);

        emit NtokenCreated(ntoken, to_, supply_);
    }

    function constructorByteCode(string memory name_, string memory symbol_, uint256 supply_, address to_) public pure returns (bytes memory) {
        bytes memory bytecode = type(Ntoken).creationCode;
        return abi.encodePacked(bytecode, abi.encode(name_, symbol_, supply_, to_));
    }

    function computeAddress(string memory name_, string memory symbol_, uint256 supply_, address to_) external view returns(address) {
        bytes memory bytecode = constructorByteCode(name_, symbol_, supply_, to_);
        bytes32 salt = keccak256(abi.encodePacked(name_, symbol_, supply_, to_));

        return Create2.computeAddress(salt, keccak256(bytecode));
    }
}
