import { UniswapV3FactoryDeployer } from "../deployer/amm/factory.deployer";
import { DashboardDeployer } from "../deployer/dashboard.deployer";
import { OrderBookDeployer } from "../deployer/order/order-book.deployer";
import { PublicConfigDeployer } from "../deployer/public-config.deployer";
import { Synchroniser } from "../lib/synchroniser";

declare type SynchroniseConfig = {}

export class DashboardSynchroniser extends Synchroniser<SynchroniseConfig> {
    protected getConfigFromFile(): SynchroniseConfig {
        return {}
    }

    protected getConfigOnline(): Promise<SynchroniseConfig> {
        return Promise.resolve({})
    }
    
    protected hasDeployed(): boolean {
        return new DashboardDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: SynchroniseConfig): Promise<void> {
        const factory = await new UniswapV3FactoryDeployer().getInstance();
        const order = await new OrderBookDeployer().getInstance();
        const config = await new PublicConfigDeployer().getInstance();

        await new DashboardDeployer().getOrDeployInstance({
            factory: factory.address,
            order: order.address,
            config: config.address
        })
    }

    protected getSynchroniseFuncs(): {} {
        return {}
    }

    protected get logTag(): string {
        return 'Dashboard-Synchroniser';
    }
}