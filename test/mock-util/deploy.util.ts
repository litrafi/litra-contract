import { BigNumber, Contract } from "ethers";
import { writeTestDeployConfig } from "../../scripts/deploy-config";
import { E18, ZERO } from "../../scripts/lib/constant";
import { construcAndWait, getContractAt, getSelfAddress } from "../../scripts/lib/utils";
import { setNetworkConfig } from "../../scripts/network-config";
import { CommonNetworkConfig, DeployConfig } from "../../scripts/type";
import { MockDataFeed, MockERC20, Nft, NftVault, Ntoken, WBNB } from "../../typechain";

export async function deployMockNft(owner: string) {
    const nft = await construcAndWait<Nft>('Nft', ['Nft', 'NFT', 'NFT.uri']);
    await nft.mint(owner);
    return nft;
}

export async function deployMockWETH() {
    const weth = await construcAndWait<WBNB>('WBNB');
    return weth;
}

export async function deployERC20Token(tokenName: string) {
    const token = await construcAndWait<MockERC20>('MockERC20', [tokenName, tokenName]);
    return token;
}

export async function deployMockNtoken(vault: NftVault & Contract) {
    const self = await getSelfAddress();
    const nft = await deployMockNft(self);
    const SUPPLY = BigNumber.from(E18).mul(2);
    const index = await vault.nftInfoLength();
    await nft.approve(vault.address, 0);
    await vault.deposit(nft.address, 0, 'Mock TNFT', '', 'MTNFT', SUPPLY, SUPPLY);
    const nftInfo = await vault.nftInfo(index);
    return getContractAt<Ntoken>('Ntoken', nftInfo.ntokenAddress);
}

export async function mockEnvForTokenizeModule() {
    const usdt = await deployERC20Token('USDT');
    const usdc = await deployERC20Token('USDC');
    const weth = await deployMockWETH();
    const usdtDataFeed = await construcAndWait<MockDataFeed>('MockDataFeed', [BigNumber.from(E18)]);
    const wethDataFeed = await construcAndWait<MockDataFeed>('MockDataFeed', [BigNumber.from(E18).mul('1126')])
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

    const self = await getSelfAddress();
    const deployConfig: DeployConfig = {
        feeTo: self,
        pricingTokens: ['USDT', 'USDC', 'ETH']
    }
    writeTestDeployConfig(deployConfig);
}