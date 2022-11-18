import "./admin/Stoppable.sol";
import "../interfaces/IBurner.sol";
import "../interfaces/IFeeManager.sol";
import "./admin/ParameterAdminManaged.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FeeManager is IFeeManager, Stoppable, ParameterAdminManaged {
    address public vault;
    uint256 constant public FEE_DENOMINATOR = 1e10;
    mapping(address => address) public burners;
    mapping(address => uint256) public wrapFees;
    mapping(address => uint256) public unwrapFees;
    uint256 public defaultWrapFee;
    uint256 public defaultUnwrapFee;

    modifier onlyVault {
        require(msg.sender == vault, "!vault");
        _;
    }

    constructor(
        address _vault
    ) OwnershipAdminManaged(msg.sender) ParameterAdminManaged(msg.sender) EmergencyAdminManaged(msg.sender) {
        vault = _vault;
    }

    function chargeWrapFee(address _nft, address _wnft, address _resetReceiver) external payable override onlyVault returns(uint256 reset) {
        uint256 fee = wrapFees[_wnft];
        if(fee == 0) {
            fee = defaultWrapFee;
        }
        uint256 b = IERC20(_wnft).balanceOf(address(this));
        reset = b * (FEE_DENOMINATOR - fee) / FEE_DENOMINATOR;
        IERC20(_wnft).transfer(_resetReceiver, reset);
    }

    function chargeUnWrapFee(address _wnft, address _operator) external payable override onlyVault {
        uint256 fee = unwrapFees[_wnft];
        if(fee == 0) {
            fee = defaultUnwrapFee;
        }
        uint256 total = fee * 1e18 / FEE_DENOMINATOR + 1e18;
        IERC20(_wnft).transferFrom(_operator, address(this), total);
    }

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

    function setBurner(address _wnft, address _burner) external onlyOwnershipAdmin {
        _setBurner(_wnft, _burner);
    }

    function setManyBurners(address[] memory _wnfts, address[] memory _burners) external onlyOwnershipAdmin {
        require(_wnfts.length == _burners.length, "Unequal arr length");
        for (uint256 index = 0; index < _wnfts.length; index++) {
            burners[_wnfts[index]] = _burners[index];
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

    function setDefaultWrapFee(uint256 _wrapFee) external onlyParameterAdmin {
        defaultWrapFee = _wrapFee;
    }

    function setDefaultUnwrapFee(uint256 _unwrapFee) external onlyParameterAdmin {
        defaultUnwrapFee = _unwrapFee;
    }

    function setWrapFee(address _wnft, uint256 _fee) external onlyParameterAdmin {
        wrapFees[_wnft] = _fee;
    }

    function setUnwrapFee(address _wnft, uint256 _fee) external onlyParameterAdmin {
        unwrapFees[_wnft] = _fee;
    }
}