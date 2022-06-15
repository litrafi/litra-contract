import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { writeTestDeployConfig } from "../../scripts/deploy-config";
import { UniswapFactoryDeployer } from "../../scripts/deployer/amm/factory.deployer";
import { PublicConfigDeployer } from "../../scripts/deployer/public-config.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { SychroniseResult } from "../../scripts/lib/synchroniser";
import { construcAndWait } from "../../scripts/lib/utils";
import { setNetworkConfig } from "../../scripts/network-config";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser";
import { CommonNetworkConfig, DeployConfig } from "../../scripts/type";
import { MockDataFeed, MockERC20, WBNB } from "../../typechain";
import { deployERC20Token, deployMockWETH } from "../mock-util/deploy.util";
import { clear } from "../mock-util/env.util";

describe('Synchroniser for tokenize module', () => {
    let usdt: MockERC20 & Contract;
    let usdc: MockERC20 & Contract;
    let weth: WBNB & Contract;
    let usdtDataFeed: MockDataFeed & Contract;
    let wethDataFeed: MockDataFeed  & Contract;
    let users: SignerWithAddress[];

    beforeEach(async () => {
        clear();
        usdt = await deployERC20Token('USDT');
        usdc = await deployERC20Token('USDC');
        weth = await deployMockWETH();
        usdtDataFeed = await construcAndWait<MockDataFeed>('MockDataFeed', [BigNumber.from(E18)]);
        wethDataFeed = await construcAndWait<MockDataFeed>('MockDataFeed', [BigNumber.from(E18).mul('1126')]);

        const networkConfig: CommonNetworkConfig = {
            weth: weth.address,
            usdt: usdt.address,
            tokensInfo: {
                USDT: {
                    address: usdt.address,
                    dataFeed: usdtDataFeed.address
                },
                USDC: {
                    address: usdc.address,
                    dataFeed: usdtDataFeed.address
                },
                ETH: {
                    address: ZERO,
                    dataFeed: wethDataFeed.address
                }
            }
        }
        setNetworkConfig(networkConfig);

        users = await ethers.getSigners();
    })

    it('Synchronise feeTo', async () => {
        const deployConfig: DeployConfig = {
            feeTo: users[0].address,
            pricingTokens: ['USDT']
        }
        // deploy
        writeTestDeployConfig(deployConfig);
        const sychorniser = new TokenizeSynchroniser();
        await sychorniser.sychornise();
        // confirm
        const factory = await new UniswapFactoryDeployer().getInstance();
        let feeTo = await factory.feeTo();
        expect(feeTo).eq(deployConfig.feeTo);
        // change deploy config
        deployConfig.feeTo = users[1].address;
        writeTestDeployConfig(deployConfig);
        const result = await sychorniser.sychornise();
        expect(result).eq(SychroniseResult.CONFIG_CHANGE);
        // confirm
        feeTo = await factory.feeTo();
        expect(feeTo).eq(deployConfig.feeTo);
    })

    it('Syncrhonise pricing token', async () => {
        const deployConfig: DeployConfig = {
            feeTo: users[0].address,
            pricingTokens: ['USDT']
        }
        // deploy
        writeTestDeployConfig(deployConfig);
        const sychorniser = new TokenizeSynchroniser();
        await sychorniser.sychornise();
        const publicConfig = await new PublicConfigDeployer().getInstance();
        // confirm
        let pricingTokens = await publicConfig.getPricingTokens();
        expect(pricingTokens).deep.eq([usdt.address]);
        // add pricing tokens
        deployConfig.pricingTokens = ['USDT', 'USDC', 'ETH'];
        writeTestDeployConfig(deployConfig);
        let result = await sychorniser.sychornise();
        expect(result).eq(SychroniseResult.CONFIG_CHANGE);
        // confirm
        pricingTokens = await publicConfig.getPricingTokens();
        expect(pricingTokens).deep.eq([usdt.address, usdc.address, ZERO]);
        // remove pricing tokens
        deployConfig.pricingTokens = ['ETH'];
        writeTestDeployConfig(deployConfig);
        result = await sychorniser.sychornise();
        expect(result).eq(SychroniseResult.CONFIG_CHANGE);
        // confirm
        pricingTokens = await publicConfig.getPricingTokens();
        expect(pricingTokens).deep.eq([ZERO]);
    })
})