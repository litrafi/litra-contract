pragma solidity ^0.8.0;

import "./tokenize/NtokenFactory.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract PublicConfig is OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    NtokenFactory public ntokenFactory;
    EnumerableSetUpgradeable.AddressSet private tokenPriceWhitelist;

    function initialize(NtokenFactory _factory) public initializer {
        __Ownable_init();

        ntokenFactory = _factory;
    }

    // ======== Owner set config ======== //

    function addPricingTokens(address[] calldata _tokens) external onlyOwner {
        for (uint256 index = 0; index < _tokens.length; index++) {
            tokenPriceWhitelist.add(_tokens[index]);
        }
    }

    function removePricingTokens(address[] calldata _tokens) external onlyOwner {
        for (uint256 index = 0; index < _tokens.length; index++) {
            tokenPriceWhitelist.remove(_tokens[index]);
        }
    }

    function getPricingTokens() external view returns(address[] memory){
        return tokenPriceWhitelist.values();
    }

    // ======== Get Config ======== //

    function isNtoken(address _token) external view returns(bool) {
        return ntokenFactory.isNtoken(_token);
    }

    function isPrcingToken(address _token) external view returns(bool) {
        return tokenPriceWhitelist.contains(_token);
    }
}