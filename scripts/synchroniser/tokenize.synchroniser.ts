import { getDeployConfig } from "../deploy-config";
import { UniswapFactoryDeployer } from "../deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../deployer/amm/router.deployer";
import { NtokenPricerDeployer } from "../deployer/ntoken-pricer.deployer";
import { OrderBookDeployer } from "../deployer/order/order-book.deployer";
import { NftVaultDeployer } from "../deployer/tokenize/nft-vault.deployer";
import { NTokenFactoryDeployer } from "../deployer/tokenize/ntoken-factory.deployer";
import { Synchroniser } from "../lib/synchroniser";
import { getNetworkConfig } from "../network-config";

declare type SynchroniserConfig = {
    feeTo: string
}
export class TokenizeSynchroniser extends Synchroniser<SynchroniserConfig> {
    protected getConfigFromFile(): SynchroniserConfig {
        const { feeTo } = getDeployConfig();
        return { feeTo };
    }

    protected async getConfigOnline(): Promise<SynchroniserConfig> {
        const factory = await new UniswapFactoryDeployer().getInstance();
        const feeTo = await factory.feeTo();
        return { feeTo };
    }

    protected hasDeployed(): boolean {
        return new NftVaultDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: SynchroniserConfig): Promise<void> {
        const { weth } = getNetworkConfig();

        const ammFactory = await new UniswapFactoryDeployer().getOrDeployInstance({ feeTo: fileConfig.feeTo });
        const ammRouter = await new UniswapRouterDeployer().getOrDeployInstance({ factory: ammFactory.address, weth });
        const orderBook = await new OrderBookDeployer().getOrDeployInstance({});
        const ntokenPricer = await new NtokenPricerDeployer().getOrDeployInstance({ ammRouter: ammRouter.address, orderBook: orderBook.address, weth })
        const factory = await new NTokenFactoryDeployer().getOrDeployInstance({});
        await new NftVaultDeployer().getOrDeployInstance({ factory: factory.address, ntokenPricer: ntokenPricer.address });
    }

    protected getSynchroniseFuncs(): { feeTo: ((fileConfig: string, onlineConfig: string) => Promise<void>) | ((fileConfig: string) => Promise<void>); } {
        return {
            feeTo: async (fileConfig: string) => {
                const factory = await new UniswapFactoryDeployer().getInstance();
                await factory.setFeeTo(fileConfig);
            }
        }
    }

    protected get logTag(): string {
        return 'tokenize-synchroniser';
    }

}