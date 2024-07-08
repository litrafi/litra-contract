// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "../interfaces/IBorrowRateModel.sol";

contract MockBorrowRateModel is IBorrowRateModel {
    function borrowRate(address) external pure override returns (uint256) {
        // apr: 10%
        return 3170979198;
    }
}