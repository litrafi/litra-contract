pragma solidity ^0.8.0;

interface IMetapool {
    function token() external view returns(address);
    function coins(uint256 index) external view returns(address);
    // function base_coins(uint256 index) external view returns(address);
    // function add_liquidity(
    //     uint256[2] calldata _deposit_amounts,
    //     uint256 _min_mint_amount,
    //     bool _use_eth,
    //     address _receiver
    // ) external payable returns(uint256);

    // function remove_liquidity(
    //     uint256 _burn_amount,
    //     uint256[2] calldata _min_amounts,
    //     bool _use_eth,
    //     address _receiver
    // ) external returns(uint256[] calldata);
}

interface IDepositManager {
    function add_liquidity(
        address _pool,
        uint256[4] calldata _deposit_amounts,
        uint256 _min_mint_amount,
        bool _use_eth,
        address _receiver
    ) external payable returns(uint256);

    function remove_liquidity(
        address _pool,
        uint256 _burn_amount,
        uint256[4] calldata _min_amounts,
        bool _use_eth,
        address _receiver
    ) external returns(uint256[] calldata);
}

interface IVotingEscrow {
    function locked(address account) external view returns(int128, uint256);
    function create_lock(uint256 value, uint256 unlockTime) external;
    function deposit_for(address account, uint256 value) external;
}