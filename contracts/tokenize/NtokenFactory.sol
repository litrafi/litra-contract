// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Ntoken.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract NtokenFactory is OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    event NtokenCreated(address indexed ntoken_, address indexed to_, uint256 supply_);

    address public ntokenCreator;
    EnumerableSetUpgradeable.AddressSet ntokens;

    function initialize() external initializer {
        __Ownable_init();
    }

    function setNtokenCreator(address _ntokenCreator) external onlyOwner {
        require(ntokenCreator == address(0), "Creator of ntoken has been set");
        ntokenCreator = _ntokenCreator;
    }

    function ntokenCodeHash() external pure returns (bytes32) {
        return keccak256(abi.encodePacked(type(Ntoken).creationCode));
    }

    function isNtoken(address _token) external view returns(bool) {
        return ntokens.contains(_token);
    }
    
    function createNtoken(string memory name_, string memory symbol_, uint256 supply_, address to_) external returns (address ntoken) {
        require(msg.sender == ntokenCreator, 'Forbidden creating TNFT');
        bytes memory bytecode = constructorByteCode(name_, symbol_, supply_, to_);
        bytes32 salt = keccak256(abi.encodePacked(name_, symbol_, supply_, to_));
        // assembly {
        //     ntoken := create2(0, add(bytecode, 32), mload(bytecode), salt)
        // }
        // require(ntoken != address(0), "Create2: Failed on deploy");
        ntoken = Create2.deploy(0, salt, bytecode);
        ntokens.add(ntoken);

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
