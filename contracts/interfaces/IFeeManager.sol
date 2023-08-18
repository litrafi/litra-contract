// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFeeManager {
    function setWrapFee(address _ft, uint256 _fee) external;
    function setUnwrapFee(address _ft, uint256 _fee) external;
    function wrapFee(address _ft) external view returns(uint256);
    function unwrapFee(address _ft) external view returns(uint256);
}