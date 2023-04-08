pragma solidity ^0.8.0;

import "./OwnershipAdminManaged.sol";

abstract contract EmergencyAdminManaged is OwnershipAdminManaged {
    event CommitEmergencyAdmin(address _admin, address _futureAdmin, address _ownershipAdmin);
    event ApplyEmergencyAdmin(address _prevAdmin, address _newAdmin);

    address public emergencyAdmin;
    address public futureEmergencyAdmin;

    constructor(address _e) {
        emergencyAdmin = _e;
    }

    modifier onlyEmergencyAdmin {
        require(msg.sender == emergencyAdmin, "! emergency admin");
        _;
    }

    function commitEmergencyAdmin(address _e) external onlyEmergencyAdmin {
        require(_e != address(0));
        futureEmergencyAdmin = _e;
        emit CommitEmergencyAdmin(emergencyAdmin, futureEmergencyAdmin, ownershipAdmin);
    }

    function applyEmergencyAdmin() external {
        require(msg.sender == futureEmergencyAdmin, "! emergency admin");
        emit ApplyEmergencyAdmin(emergencyAdmin, futureEmergencyAdmin);
        emergencyAdmin = futureEmergencyAdmin;
        futureEmergencyAdmin = address(0);
    }
}