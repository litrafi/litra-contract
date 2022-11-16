pragma solidity ^0.8.0;

import "./EmergencyAdminManaged.sol";
import "./ParameterAdminManaged.sol";

abstract contract Stoppable is EmergencyAdminManaged {
    bool public stopped;

    modifier onlyNotStopped {
        require(!stopped, "stopped");
        _;
    }

    function setStopped(bool _stopped) external {
        require(msg.sender == emergencyAdmin || msg.sender == ownershipAdmin, "Access denied");
        stopped = _stopped;
    }
}