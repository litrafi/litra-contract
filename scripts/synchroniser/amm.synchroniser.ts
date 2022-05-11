import { getDeployConfig } from "../deploy-config";
import { UniswapFactoryDeployer } from "../deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../deployer/amm/router.deployer";
import { Synchroniser } from "../lib/synchroniser";
import { getNetworkConfig } from "../network-config";

declare type SynchroniserConfig = {
    feeTo: string
}

export class AmmSynchroniser extends Synchroniser<SynchroniserConfig> {
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
        return new UniswapRouterDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: SynchroniserConfig): Promise<void> {
        const { weth } = getNetworkConfig();

        const factory = await new UniswapFactoryDeployer().getOrDeployInstance({ feeTo: fileConfig.feeTo });
        await new UniswapRouterDeployer().getOrDeployInstance({
            factory: factory.address,
            weth
        });
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
        return 'Amm-Syncrhoniser';
    }
}