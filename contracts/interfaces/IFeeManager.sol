pragma solidity ^0.8.0;

interface IFeeManager {
    function wrapFee(address _ft) external view returns(uint256);
    function unwrapFee(address _ft) external view returns(uint256);
}