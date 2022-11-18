pragma solidity ^0.8.0;

import "./VotingEscrow.sol";
import "./admin/OwnershipAdminManaged.sol";
import "../interfaces/IDAO.sol";

contract VEBoostProxy is OwnershipAdminManaged{
    VotingEscrow public ve;
    address public boost;

    constructor(VotingEscrow _ve) OwnershipAdminManaged(msg.sender) {
        ve = _ve;
    }

    function setBoost(address _boost) external onlyOwnershipAdmin {
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