import { getDeployConfig } from "../deploy-config";
import { UniswapFactoryDeployer } from "../deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../deployer/amm/router.deployer";
import { NtokenPricerDeployer } from "../deployer/ntoken-pricer.deployer";
import { OrderBookDeployer } from "../deployer/order/order-book.deployer";
import { PublicConfigDeployer } from "../deployer/public-config.deployer";
import { NftVaultDeployer } from "../deployer/tokenize/nft-vault.deployer";
import { NTokenFactoryDeployer } from "../deployer/tokenize/ntoken-factory.deployer";
import { Synchroniser } from "../lib/synchroniser";
import { getDifferent } from "../lib/utils";
import { getNetworkConfig } from "../network-config";

declare type SynchroniserConfig = {
    feeTo: string,
    pricingTokens: {
        address: string,
        dataFeed: string
    }[]
}

export class TokenizeSynchroniser extends Synchroniser<SynchroniserConfig> {
    protected getConfigFromFile(): SynchroniserConfig {
        const { feeTo, pricingTokens } = getDeployConfig();
        const { tokensInfo } = getNetworkConfig();
        const _pricingTokens: SynchroniserConfig['pricingTokens'] = []
        for (const tokenName of pricingTokens) {
            const { dataFeed, address } = tokensInfo[tokenName];
            if(!dataFeed) throw new Error(`Data feed address of ${tokenName} is not configured on file`)
            _pricingTokens.push({
                address,
                dataFeed
            })
        }
        return { feeTo, pricingTokens: _pricingTokens };
    }

    protected async getConfigOnline(): Promise<SynchroniserConfig> {
        const factory = await new UniswapFactoryDeployer().getInstance();
        const pricer = await new NtokenPricerDeployer().getInstance();
        const publicConfig = await new PublicConfigDeployer().getInstance();

        const feeTo = await factory.feeTo();

        const pricingTokens = await publicConfig.getPricingTokens();
        const _pricingTokens: SynchroniserConfig['pricingTokens'] = [];
        for (const tokenAddress of pricingTokens) {
            const dataFeed = await pricer.dataFeeds(tokenAddress);
            _pricingTokens.push({
                address: tokenAddress,
                dataFeed
            })
        }
        return { feeTo, pricingTokens: _pricingTokens };
    }

    protected hasDeployed(): boolean {
        return new NftVaultDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: SynchroniserConfig): Promise<void> {
        const { weth, usdt } = getNetworkConfig();

        const factory = await new NTokenFactoryDeployer().getOrDeployInstance({});
        const publicConfig = await new PublicConfigDeployer().getOrDeployInstance({
            weth,
            usdt,
            factory: factory.address,
            pricingToken: fileConfig.pricingTokens.map(e => e.address)
        });
        const ammFactory = await new UniswapFactoryDeployer().getOrDeployInstance({ feeTo: fileConfig.feeTo });
        const ammRouter = await new UniswapRouterDeployer().getOrDeployInstance({ factory: ammFactory.address, weth });
        const orderBook = await new OrderBookDeployer().getOrDeployInstance({ config: publicConfig.address });
        const ntokenPricer = await new NtokenPricerDeployer().getOrDeployInstance({
            ammRouter: ammRouter.address,
            orderBook: orderBook.address,
            config: publicConfig.address,
            dataFeeds: fileConfig.pricingTokens.map(e => ({ tokenAddress: e.address, dataFeed: e.dataFeed }))
        })
        const vault = await new NftVaultDeployer().getOrDeployInstance({
            factory: factory.address,
            ntokenPricer: ntokenPricer.address,
            config: publicConfig.address
        });
        await factory.setNtokenCreator(vault.address);
    }

    protected getSynchroniseFuncs() {
        return {
            feeTo: async (fileConfig: string) => {
                const factory = await new UniswapFactoryDeployer().getInstance();
                await factory.setFeeTo(fileConfig);
            },
            pricingTokens: this.synchronisePricingToken.bind(this)
        }
    }

    protected get logTag(): string {
        return 'tokenize-synchroniser';
    }

    private async synchronisePricingToken(fileConfig: SynchroniserConfig['pricingTokens'], onlineConfig: SynchroniserConfig['pricingTokens']) {
        const pricer = await new NtokenPricerDeployer().getInstance();
        // sycnhronise data feed
        const token = [];
        const feeds = [];
        for (const dataFeed of fileConfig) {
            token.push(dataFeed.address);
            feeds.push(dataFeed.dataFeed)
        }
        await pricer.setDataFeeds(token, feeds);
        // syncrhonise pricing token
        const configTokensAddress = fileConfig.map(e => e.address);
        const onlineTokensAddress = onlineConfig.map(e => e.address);
        const { deleted, added } = getDifferent(onlineTokensAddress, configTokensAddress);
        const publicConfig = await new PublicConfigDeployer().getInstance();
        await publicConfig.removePricingTokens(deleted);
        await publicConfig.addPricingTokens(added);
    }
}