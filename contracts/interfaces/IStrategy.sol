// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStrategy {
    function redeem(address _nft, uint256 _tokenId, address _recipient) external;
    function kill() external;
}