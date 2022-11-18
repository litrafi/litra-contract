pragma solidity ^0.8.0;

contract OwnershipAdminManaged {
    address public ownershipAdmin;
    address public futureOwnershipAdmin;

    constructor(address _o) {
        ownershipAdmin = _o;
    }

    modifier onlyOwnershipAdmin {
        require(msg.sender == ownershipAdmin, "! ownership admin");
        _;
    }

    function commitOwnershipAdmin(address _o) external onlyOwnershipAdmin {
        futureOwnershipAdmin = _o;
    }

    function applyOwnershipAdmin() external {
        require(msg.sender == futureOwnershipAdmin, "Access denied!");
        ownershipAdmin = futureOwnershipAdmin;
    }
}