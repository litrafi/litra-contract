pragma solidity ^0.8.0;

import "./OwnershipAdminManaged.sol";

abstract contract ParameterAdminManaged is OwnershipAdminManaged {
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
        futureParameterAdmin = _p;
    }

    function applyParameterAdmin() external {
        require(msg.sender == futureParameterAdmin, "Access denied!");
        parameterAdmin = futureParameterAdmin;
    }
}