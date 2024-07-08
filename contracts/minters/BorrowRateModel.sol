// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/IBorrowRateModel.sol";

contract BorrowRateModel is IBorrowRateModel {
    function borrowRate(address) external pure override returns (uint256) {
        return 0;
    }
}