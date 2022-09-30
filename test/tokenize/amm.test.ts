import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { UniswapV3FactoryDeployer } from "../../scripts/deployer/amm/factory.deployer";
import { PositionManagerDeployer } from "../../scripts/deployer/amm/position-manager.deployer";
import { SwapRouterDeployer } from "../../scripts/deployer/amm/router.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { getContractAt } from "../../scripts/lib/utils";
import { getNetworkConfig } from "../../scripts/network-config";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser";
import { NonfungiblePositionManager, SwapRouter, UniswapV3Factory, UniswapV3Pool, WBNB } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployERC20Token, mockEnvForTokenizeModule } from "../mock-util/deploy.util";
import { clear } from "../mock-util/env.util";
import { expectCloseTo } from "../mock-util/expect-plus.util";

describe('Amm', () => {
    let user: SignerWithAddress;

    let factoryContract: UniswapV3Factory & Contract;
    let routerContract: SwapRouter & Contract;
    let positionManager: NonfungiblePositionManager & Contract;

    let weth: WBNB & Contract;

    before(async () => {
        clear();

        const users = await ethers.getSigners();
        user = users[0];


        await mockEnvForTokenizeModule();
        const networkConfig = getNetworkConfig();

        await new TokenizeSynchroniser().sychornise();

        weth = await getContractAt<WBNB>('WBNB', networkConfig.weth);
        factoryContract = await new UniswapV3FactoryDeployer().getInstance();
        routerContract = await new SwapRouterDeployer().getInstance();
        positionManager = await new PositionManagerDeployer().getInstance();
    })

    it('Add liquidity', async () => {
        // create pair
        const FEE_RATIO = '3000';
        const SQRT_PRICE = BigNumber.from(2).pow(96);
        const tnft = await deployERC20Token('TNFT');
        await factoryContract.createPool(tnft.address, weth.address, FEE_RATIO);
        const pairAddress = await factoryContract.getPool(tnft.address, weth.address, FEE_RATIO);
        const pairContract = await getContractAt<UniswapV3Pool>('UniswapV3Pool', pairAddress);
        await pairContract.initialize(SQRT_PRICE);
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();
        // add liquidity
        const DEPOSIT_AMOUNT = BigNumber.from(E18).mul(2);
        const { tick } = await pairContract.slot0();        
        await tnft.mint(user.address, DEPOSIT_AMOUNT);
        await tnft.approve(positionManager.address, DEPOSIT_AMOUNT);
        const tickSpacing = await pairContract.tickSpacing();

        const comparator = new BalanceComparator(user.address);
        await comparator.setBeforeBalance(tnft.address);
        await comparator.setBeforeBalance(weth.address);
        await positionManager.mint({
            token0,
            token1,
            fee: FEE_RATIO,
            amount0Desired: DEPOSIT_AMOUNT,
            amount1Desired: DEPOSIT_AMOUNT,
            amount0Min: 0,
            amount1Min: 0,
            recipient: user.address,
            deadline: '9999999999',
            tickLower: tick - tickSpacing,
            tickUpper: tick + tickSpacing
        }, { value: DEPOSIT_AMOUNT })
        await comparator.setAfterBalance(tnft.address);
        expect(comparator.compare(tnft.address).eq(DEPOSIT_AMOUNT))
        // get position
        const positionBalance = await positionManager.balanceOf(user.address);
        expect(positionBalance.toNumber()).eq(1);
        const positionId = await positionManager.tokenByIndex(0);
        expect(positionId).deep.eq(BigNumber.from(1));
        let position = await positionManager.positions(positionId);
        // increase liquidity
        await tnft.mint(user.address, DEPOSIT_AMOUNT);
        await tnft.approve(positionManager.address, DEPOSIT_AMOUNT);
        await positionManager.increaseLiquidity({
            tokenId: positionId,
            amount0Desired: DEPOSIT_AMOUNT,
            amount1Desired: DEPOSIT_AMOUNT,
            amount0Min: 0,
            amount1Min: 0,
            deadline: '9999999999'
        }, { value: DEPOSIT_AMOUNT })
        // remove liquidity
        position = await positionManager.positions(positionId);
        await positionManager.decreaseLiquidity({
            tokenId: positionId,
            liquidity: position.liquidity,
            amount0Min: 0,
            amount1Min: 0,
            deadline: '9999999999'
        })
        position = await positionManager.positions(positionId);
        await positionManager.collect({
            tokenId: positionId,
            recipient: user.address,
            amount0Max: position.tokensOwed0,
            amount1Max: position.tokensOwed1
        })
        await positionManager.burn(positionId)
    })

    it('Swap', async () => {
        // create pair
        const FEE_RATIO = '3000';
        const SQRT_PRICE = BigNumber.from(2).pow(96);
        const tnft = await deployERC20Token('TNFT');
        await factoryContract.createPool(tnft.address, weth.address, FEE_RATIO);
        const pairAddress = await factoryContract.getPool(tnft.address, weth.address, FEE_RATIO);
        const pairContract = await getContractAt<UniswapV3Pool>('UniswapV3Pool', pairAddress);
        await pairContract.initialize(SQRT_PRICE);
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();
        // add liquidity
        const DEPOSIT_AMOUNT = BigNumber.from(E18).mul(2);
        const { tick } = await pairContract.slot0();        
        await tnft.mint(user.address, DEPOSIT_AMOUNT);
        await tnft.approve(positionManager.address, DEPOSIT_AMOUNT);
        const tickSpacing = await pairContract.tickSpacing();

        await positionManager.mint({
            token0,
            token1,
            fee: FEE_RATIO,
            amount0Desired: DEPOSIT_AMOUNT,
            amount1Desired: DEPOSIT_AMOUNT,
            amount0Min: 0,
            amount1Min: 0,
            recipient: user.address,
            deadline: '9999999999',
            tickLower: tick - tickSpacing,
            tickUpper: tick + tickSpacing
        }, { value: DEPOSIT_AMOUNT })
        // Swap
        const SWAP_AMOUNT = BigNumber.from(E18);
        // swap
        await tnft.mint(user.address, SWAP_AMOUNT);
        await tnft.approve(routerContract.address, SWAP_AMOUNT);
        await weth.approve(routerContract.address, SWAP_AMOUNT);

        const comparator = new BalanceComparator(user.address);
        await comparator.setBeforeBalance(tnft.address);
        await comparator.setBeforeBalance(ZERO);
        const swapSendData = routerContract.interface.encodeFunctionData('exactInputSingle', [
            {
                tokenIn: tnft.address,
                tokenOut: weth.address,
                fee: FEE_RATIO,
                recipient: ZERO,
                deadline: '9999999999',
                amountIn: SWAP_AMOUNT,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            }
        ])
        const unwrapSendData = routerContract.interface.encodeFunctionData('unwrapWETH9', [0, user.address]);
        await routerContract.multicall([swapSendData, unwrapSendData])
        await comparator.setAfterBalance(tnft.address);
        await comparator.setAfterBalance(ZERO);
        expect(comparator.compare(tnft.address).eq(SWAP_AMOUNT))
        expectCloseTo(comparator.compare(ZERO), SWAP_AMOUNT, 2);
    })
})