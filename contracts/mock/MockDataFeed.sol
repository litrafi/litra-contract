pragma solidity ^0.8.0;

contract MockDataFeed {
    int256 private price;
    uint8 public decimals = 8;

    constructor(int256 _price) {
        price = _price;
    }

    function latestRoundData() external view returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
        return (0, price, 0, 0, 0);
    }

}