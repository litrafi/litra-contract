import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { UniswapFactoryDeployer } from "../scripts/deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../scripts/deployer/amm/router.deployer";
import { DashboardDeployer } from "../scripts/deployer/dashboard.deployer";
import { OrderBookDeployer } from "../scripts/deployer/order/order-book.deployer";
import { NftVaultDeployer } from "../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../scripts/lib/constant";
import { getContractAt, getSelfAddress } from "../scripts/lib/utils";
import { getNetworkConfig } from "../scripts/network-config";
import { DashboardSynchroniser } from "../scripts/synchroniser/dashboard.synchroniser";
import { TokenizeSynchroniser } from "../scripts/synchroniser/tokenize.synchroniser";
import { WBNB } from "../typechain";
import { Dashboard } from "../typechain/Dashboard";
import { deployMockNtoken, mockEnvForTokenizeModule } from "./mock-util/deploy.util";
import { clear, currentTime } from "./mock-util/env.util"

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
        // add liquidity to amm
        const routerContract = await new UniswapRouterDeployer().getInstance();
        const factoryContract = await new UniswapFactoryDeployer().getInstance();
        // create pair
        await factoryContract.createPair(tnft.address, weth.address);
        const pair = await factoryContract.getPair(tnft.address, weth.address);
        // add liquidity
        const TNFT_AMOUNT = BigNumber.from(E18);
        const WETH_AMOUNT = BigNumber.from(E18);
        await weth.deposit({ value: WETH_AMOUNT });
        await tnft.approve(routerContract.address, TNFT_AMOUNT);
        await weth.approve(routerContract.address, WETH_AMOUNT);
        const now = await currentTime();
        await routerContract.addLiquidity(
            tnft.address,
            weth.address,
            TNFT_AMOUNT,
            WETH_AMOUNT,
            0, 0,
            self,
            now + 1
        );
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