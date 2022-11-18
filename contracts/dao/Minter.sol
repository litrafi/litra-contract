pragma solidity ^0.8.0;

import "./LiquidityGauge.sol";
import "./GaugeController.sol";

contract Minter is ReentrancyGuard {
    event Minted(address recipient, address gauge, uint256 minted);

    LA public token;
    GaugeController public controller;

    // user -> gauge -> value
    mapping(address => mapping(address => uint256)) public minted;
    // minter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowedToMintFor;

    constructor(LA _token, GaugeController _controller) ReentrancyGuard() {
        token = _token;
        controller = _controller;
    }

    function _mintFor(address _gaugeAddr, address _for) internal {
        require(controller.gaugeTypes(_gaugeAddr) >= 0, "gauge is not added");

        LiquidityGauge(_gaugeAddr).userCheckpoint(_for);
        uint256 totalMint = LiquidityGauge(_gaugeAddr).integrateFraction(_for);
        uint256 toMint = totalMint - minted[_for][_gaugeAddr];

        if(toMint != 0) {
            token.mint(_for, toMint);
            minted[_for][_gaugeAddr] = totalMint;

            emit Minted(_for, _gaugeAddr, totalMint);
        }
    }

    /**
        @notice Mint everything which belongs to `msg.sender` and send to them
        @param _gaugeAddr `LiquidityGauge` address to get mintable amount from
     */
    function mint(address _gaugeAddr) external nonReentrant {
        _mintFor(_gaugeAddr, msg.sender);
    }

    function mintMany(address[] calldata _gaugeAddrs) external nonReentrant {
        for (uint256 index = 0; index < _gaugeAddrs.length; index++) {
            _mintFor(_gaugeAddrs[index], msg.sender);
        }
    }

    function mintFor(address _gaugeAddr, address _for) external nonReentrant {
        if(allowedToMintFor[msg.sender][_for]) {
            _mintFor(_gaugeAddr, _for);
        }
    }

    function toggleApproveMint(address _mintingUser) external {
        allowedToMintFor[_mintingUser][msg.sender] = !allowedToMintFor[_mintingUser][msg.sender];
    }
}