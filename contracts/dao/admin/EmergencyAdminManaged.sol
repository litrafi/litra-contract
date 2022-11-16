pragma solidity ^0.8.0;

import "./OwnershipAdminManaged.sol";

abstract contract EmergencyAdminManaged is OwnershipAdminManaged {
    address public emergencyAdmin;
    address public futureEmergencyAdmin;

    constructor(address _e) {
        emergencyAdmin = _e;
    }

    modifier onlyEmergencyAdmin {
        require(msg.sender == emergencyAdmin, "! emergency admin");
        _;
    }

    function commitEmergencyAdmin(address _o) external onlyEmergencyAdmin {
        futureEmergencyAdmin = _o;
    }
}