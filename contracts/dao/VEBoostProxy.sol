pragma solidity ^0.8.0;

import "./VotingEscrow.sol";
import "../interfaces/IDAO.sol";

contract VEBoostProxy {
    VotingEscrow public ve;
    address public boost;
    address public admin;

    modifier onlyAdmin {
        require(msg.sender == admin, "!admin");
        _;
    }

    constructor(VotingEscrow _ve) {
        ve = _ve;
        admin = msg.sender;
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid new admin");
        admin = _newAdmin;
    }

    function setBoost(address _boost) external onlyAdmin {
        boost = _boost;
    }

    function adjustedBalanceOf(address _account) external view returns(uint256){
        if(boost != address(0)) {
            return VotingEscrowBoost(boost).adjustedBalanceOf(_account);
        } else {
            return ve.balanceOf(_account);
        }
    }
}