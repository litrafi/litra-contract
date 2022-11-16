pragma solidity ^0.8.0;

interface IFeeManager {
    function chargeWrapFee(address _nft, address _ft, address _restReceiver) external payable returns(uint256 reset);
    function chargeUnWrapFee(address _ft, address _operator) external payable;
}