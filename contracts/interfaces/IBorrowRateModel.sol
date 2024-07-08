// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IBorrowRateModel {
    function borrowRate(address nft) external view returns(uint);
}