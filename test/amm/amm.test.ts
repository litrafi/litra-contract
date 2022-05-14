import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { writeTestDeployConfig } from "../../scripts/deploy-config";
import { UniswapFactoryDeployer } from "../../scripts/deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../../scripts/deployer/amm/router.deployer";
import { E18 } from "../../scripts/lib/constant";
import { getContractAt } from "../../scripts/lib/utils";
import { setTestNetworkConfig } from "../../scripts/network-config";
import { AmmSynchroniser } from "../../scripts/synchroniser/amm.synchroniser";
import { UniswapV2Factory, UniswapV2Pair, UniswapV2Router02, WBNB } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployERC20Token, deployMockWETH } from "../mock-util/deploy.util";
import { clear, getNowRoughly } from "../mock-util/env.util";

describe('Amm', () => {
    let user: SignerWithAddress;
    let feeTo: SignerWithAddress;

    let factoryContract: UniswapV2Factory & Contract;
    let routerContract: UniswapV2Router02 & Contract;

    let weth: WBNB & Contract;

    before(async () => {
        clear();

        const users = await ethers.getSigners();
        user = users[0];
        feeTo = users[1];

        weth = await deployMockWETH();

        setTestNetworkConfig({ weth: weth.address });
        writeTestDeployConfig({ feeTo: feeTo.address });

        await new AmmSynchroniser().sychornise();

        factoryContract = await new UniswapFactoryDeployer().getInstance();
        routerContract = await new UniswapRouterDeployer().getInstance();
    })

    it('Create pool & swap', async () => {
        // create pair
        const tnft = await deployERC20Token('TNFT');
        await factoryContract.createPair(tnft.address, weth.address);
        const pairAddress = await factoryContract.getPair(tnft.address, weth.address);
        const pairContract = await getContractAt<UniswapV2Pair>('UniswapV2Pair', pairAddress);
        // add liquidity
        const TNFT_AMOUNT = BigNumber.from(E18).mul(2);
        const WETH_AMOUNT = BigNumber.from(E18).mul(2);
        
        await tnft.mint(user.address, TNFT_AMOUNT);
        await weth.deposit({ value: WETH_AMOUNT });

        await tnft.approve(routerContract.address, TNFT_AMOUNT);
        await weth.approve(routerContract.address, WETH_AMOUNT);

        await routerContract.addLiquidity(
            tnft.address,
            weth.address,
            TNFT_AMOUNT,
            WETH_AMOUNT,
            0, 0,
            user.address,
            getNowRoughly() + 1000
        )

        const pairBalance = await pairContract.balanceOf(user.address);
        expect(pairBalance.toString()).eq('1999999999999999000');
        console.log(`Pair balance: ${pairBalance.toString()}`);
        
        // swap
        const ETH_SWAP_AMOUNT = BigNumber.from(E18).mul(2);
        // evaluation price
        const amounsOut = await routerContract.getAmountsOut(ETH_SWAP_AMOUNT, [weth.address, tnft.address]);
        const estimatedPrice = await BalanceComparator.getReadableAmount(tnft.address, amounsOut[1]);

        const comparator = new BalanceComparator(user.address);
        await comparator.setBeforeBalance(tnft.address);

        // try swap without eth
        const err = await routerContract.swapExactETHForTokens(
            0,
            [weth.address, tnft.address],
            user.address,
            getNowRoughly() + 1000
        ).catch(() => "err");
        expect(err).eq("err");
        // swap with eth
        await routerContract.swapExactETHForTokens(
            0,
            [weth.address, tnft.address],
            user.address,
            getNowRoughly() + 1000,
            { value: ETH_SWAP_AMOUNT }
        )

        await comparator.setAfterBalance(tnft.address);
        const growth = await comparator.readableCompare(tnft.address);
        expect(growth).eq(0.9984977466199298);
        expect(estimatedPrice).closeTo(growth, growth / 1e4);
    })
})