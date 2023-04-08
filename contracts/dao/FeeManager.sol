// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./admin/Stoppable.sol";
import "../interfaces/IBurner.sol";
import "../interfaces/IFeeManager.sol";
import "./admin/ParameterAdminManaged.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FeeManager is IFeeManager, Stoppable, ParameterAdminManaged {
    event SetWrapFee(address _wnft, uint256 prevFee, uint256 newFee);
    event SetUnwrapFee(address _wnft, uint256 prevFee, uint256 newFee);

    struct Fee {
        bool initialized;
        uint256 value;
    }

    address public immutable vault;
    address public feeInitiator;
    mapping(address => address) public burners;
    mapping(address => Fee) public _wrapFee;
    mapping(address => Fee) public _unwrapFee;

    modifier onlyVault {
        require(msg.sender == vault, "!vault");
        _;
    }

    constructor(
        address _vault,
        address _oAdmin,
        address _pAdmin,
        address _eAdmin
    ) OwnershipAdminManaged(_oAdmin) ParameterAdminManaged(_pAdmin) EmergencyAdminManaged(_eAdmin) {
        vault = _vault;
    }

    function setFeeInitiator(address _feeInitiator) external onlyOwnershipAdmin {
        feeInitiator = _feeInitiator;
    }

    /**
        @notice Set burner for specified WNFT, approve max allowance for burner
     */
    function _setBurner(address _wnft, address _burner) internal {
        address oldBurner = burners[_wnft];
        if(oldBurner != address(0)) {
            IERC20(_wnft).approve(oldBurner, 0);
        }
        if(_burner != address(0)) {
            IERC20(_wnft).approve(_burner, type(uint256).max);
        }
        burners[_wnft] = _burner;
    }

    /**
        @notice Get fee for wrapping
        @param _wnft address of wnft.The fee of each WNFT can be different.
     */
    function wrapFee(address _wnft) external override view returns(uint256) {
        return _wrapFee[_wnft].value;
    }

    /**
        @notice Get fee for unwrapping
        @param _wnft address of wnft.The fee of each WNFT can be different.
     */
    function unwrapFee(address _wnft) external override view returns(uint256) {
        return _unwrapFee[_wnft].value;
    }

    function setBurner(address _wnft, address _burner) external onlyOwnershipAdmin {
        _setBurner(_wnft, _burner);
    }

    function setManyBurners(address[] memory _wnfts, address[] memory _burners) external onlyOwnershipAdmin {
        require(_wnfts.length == _burners.length, "Unequal arr length");
        for (uint256 index = 0; index < _wnfts.length; index++) {
            _setBurner(_wnfts[index], _burners[index]);
        }
    }

    function _burn(address _wnft) internal {
        IBurner(burners[_wnft]).burn(_wnft);
    }

    function burn(address _wnft) external onlyNotStopped {
        _burn(_wnft);
    }

    function burnMany(address[] memory _wnfts) external onlyNotStopped {
        for (uint256 index = 0; index < _wnfts.length; index++) {
            _burn(_wnfts[index]);
        }
    }

    /**
        @notice Set fee for wrapping.
        Anyone can make the first setting,but generally the first maker will be creator of wnft.
        After first setting, only parameter admin can change
     */
    function setWrapFee(address _wnft, uint256 _fee) external override {
        Fee memory fee = _wrapFee[_wnft];
        require(
            (!fee.initialized && msg.sender == feeInitiator) 
                || msg.sender == parameterAdmin,
            "Not admin or initiator"
        );
        _wrapFee[_wnft] = Fee(true, _fee);
        emit SetWrapFee(_wnft, fee.value, _fee);
    }

    /**
        @notice Set fee for unwrapping.
        Anyone can make the first setting,but generally the first maker will be creator of wnft.
        After first setting, only parameter admin can change
     */
    function setUnwrapFee(address _wnft, uint256 _fee) external override {
        Fee memory fee = _unwrapFee[_wnft];
        require(
            (!fee.initialized && msg.sender == feeInitiator) 
                || msg.sender == parameterAdmin,
            "Not admin or initiator"
        );
        _unwrapFee[_wnft] = Fee(true, _fee);
        emit SetUnwrapFee(_wnft, fee.value, _fee);
    }
}