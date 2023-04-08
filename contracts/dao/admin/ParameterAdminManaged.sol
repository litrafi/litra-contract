pragma solidity ^0.8.0;

import "./OwnershipAdminManaged.sol";

abstract contract ParameterAdminManaged is OwnershipAdminManaged {
    event CommitParameterAdmin(address _admin, address _futureAdmin, address _ownershipAdmin);
    event ApplyParameterAdmin(address _prevAdmin, address _newAdmin);

    address public parameterAdmin;
    address public futureParameterAdmin;

    constructor(address _e) {
        parameterAdmin = _e;
    }

    modifier onlyParameterAdmin {
        require(msg.sender == parameterAdmin, "! parameter admin");
        _;
    }

    function commitParameterAdmin(address _p) external onlyOwnershipAdmin {
        require(_p != address(0));
        futureParameterAdmin = _p;
        emit CommitParameterAdmin(parameterAdmin, futureParameterAdmin, ownershipAdmin);
    }

    function applyParameterAdmin() external {
        require(msg.sender == futureParameterAdmin, "Access denied!");
        emit ApplyOwnershipAdmin(parameterAdmin, futureParameterAdmin);
        parameterAdmin = futureParameterAdmin;
        futureParameterAdmin = address(0);
    }
}