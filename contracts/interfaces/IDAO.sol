pragma solidity ^0.8.0;

interface SmartWalletChecker {
    function check(address _addr) external returns(bool);
}

interface VotingEscrowBoost {
    function adjustedBalanceOf(address _account) external view returns(uint256);
}

interface Controller {
    function period() external view returns(int128);
    function periodWrite() external returns(int128);
    function periodTimestamp(int128 p) external view returns(uint256);
    function gaugeRelativeWeight(address addr, uint256 time) external view returns(uint256);
    function votingEscrow() external view returns(address);
    function checkpoint() external;
    function checkpointGauge(address addr) external;
}

interface IMinter {
    function token() external view returns(address);
    function controller() external view returns(address); 
    function minted(address user, address gauge) external view returns(uint256);
}
