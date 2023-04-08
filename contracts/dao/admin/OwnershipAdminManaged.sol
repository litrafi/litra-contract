pragma solidity ^0.8.0;

contract OwnershipAdminManaged {
    event CommitOwnershipAdmin(address _admin, address _futureAdmin);
    event ApplyOwnershipAdmin(address _prevAdmin, address _newAdmin);

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
        require(_o != address(0));
        futureOwnershipAdmin = _o;
        emit CommitOwnershipAdmin(ownershipAdmin, futureOwnershipAdmin);
    }

    function applyOwnershipAdmin() external {
        require(msg.sender == futureOwnershipAdmin, "Access denied!");
        emit ApplyOwnershipAdmin(ownershipAdmin, futureOwnershipAdmin);
        ownershipAdmin = futureOwnershipAdmin;
        futureOwnershipAdmin = address(0);
    }
}