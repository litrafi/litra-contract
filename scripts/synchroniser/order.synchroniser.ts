import { OrderBookDeployer } from "../deployer/order/order-book.deployer";
import { Synchroniser } from "../lib/synchroniser";

export class OrderSynchroniser extends Synchroniser<{}> {
    protected getConfigFromFile(): {} {
        return {}
    }

    protected getConfigOnline(): Promise<{}> {
        return Promise.resolve({});
    }

    protected hasDeployed(): boolean {
        return new OrderBookDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: {}): Promise<void> {
        await new OrderBookDeployer().getOrDeployInstance({});
    }

    protected getSynchroniseFuncs(): {} {
        return {};
    }

    protected get logTag(): string {
        return 'Order-Synchroniser';
    }
}