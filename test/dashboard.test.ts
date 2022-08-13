import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { UniswapV3FactoryDeployer } from "../scripts/deployer/amm/factory.deployer";
import { PositionManagerDeployer } from "../scripts/deployer/amm/position-manager.deployer";
import { DashboardDeployer } from "../scripts/deployer/dashboard.deployer";
import { OrderBookDeployer } from "../scripts/deployer/order/order-book.deployer";
import { NftVaultDeployer } from "../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../scripts/lib/constant";
import { getContractAt, getSelfAddress } from "../scripts/lib/utils";
import { getNetworkConfig } from "../scripts/network-config";
import { DashboardSynchroniser } from "../scripts/synchroniser/dashboard.synchroniser";
import { TokenizeSynchroniser } from "../scripts/synchroniser/tokenize.synchroniser";
import { UniswapV3Pool, WBNB } from "../typechain";
import { Dashboard } from "../typechain/Dashboard";
import { deployMockNtoken, mockEnvForTokenizeModule } from "./mock-util/deploy.util";
import { clear } from "./mock-util/env.util"

describe('Dashboard', () => {
    let dashboardContract: Dashboard & Contract;
    let weth: WBNB & Contract;


    beforeEach(async () => {
        clear();

        await mockEnvForTokenizeModule();
        await new TokenizeSynchroniser().sychornise();
        await new DashboardSynchroniser().sychornise();
        const networkConfig = getNetworkConfig();

        dashboardContract = await new DashboardDeployer().getInstance();
        weth = await getContractAt<WBNB>('WBNB', networkConfig.weth);
    })

    it('Get tnft circulating supply', async () => {
        const vault = await new NftVaultDeployer().getInstance();
        const tnft = await deployMockNtoken(vault);
        const self = await getSelfAddress();
        const SQRT_PRICE = BigNumber.from(2).pow(96);
        const FEE_RATIO = '3000';
        // add liquidity to amm
        const factoryContract = await new UniswapV3FactoryDeployer().getInstance();
        const positionManager = await new PositionManagerDeployer().getInstance();
        // create pair
        await factoryContract.createPool(tnft.address, weth.address, FEE_RATIO);
        const pairAddress = await factoryContract.getPool(tnft.address, weth.address, FEE_RATIO);
        const pairContract = await getContractAt<UniswapV3Pool>('UniswapV3Pool', pairAddress);
        await pairContract.initialize(SQRT_PRICE);
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();
        const { tick } = await pairContract.slot0();        
        const tickSpacing = await pairContract.tickSpacing();
        // add liquidity
        const TNFT_AMOUNT = BigNumber.from(E18);
        const WETH_AMOUNT = BigNumber.from(E18);
        await tnft.approve(positionManager.address, TNFT_AMOUNT);
        await positionManager.mint({
            token0,
            token1,
            fee: FEE_RATIO,
            amount0Desired: TNFT_AMOUNT,
            amount1Desired: WETH_AMOUNT,
            amount0Min: 0,
            amount1Min: 0,
            recipient: self,
            deadline: '9999999999',
            tickLower: tick - tickSpacing,
            tickUpper: tick + tickSpacing
        }, { value: WETH_AMOUNT })
        // add liquidity to order
        const orderBookContract = await new OrderBookDeployer().getInstance();
        const SELL_AMOUNT = BigNumber.from(E18);
        const PRICE = BigNumber.from(E18);
        await tnft.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnft.address,
            SELL_AMOUNT,
            ZERO,
            PRICE,
        );
        // check circulating supply
        const circulation = await dashboardContract.getTnftCirculation(tnft.address);
        expect(circulation).eq(SELL_AMOUNT.add(TNFT_AMOUNT));
    })
})