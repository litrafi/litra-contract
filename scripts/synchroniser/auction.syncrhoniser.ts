import { AuctionBookDeployer } from "../deployer/auction/auction-book.deployer";
import { Synchroniser } from "../lib/synchroniser";

export class AuctionSynchroniser extends Synchroniser<{}> {
    protected getConfigFromFile(): {} {
        return {}
    }

    protected getConfigOnline(): Promise<{}> {
        return Promise.resolve({});
    }

    protected hasDeployed(): boolean {
        return new AuctionBookDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: {}): Promise<void> {
        await new AuctionBookDeployer().getOrDeployInstance({});
    }
    
    protected getSynchroniseFuncs(): {} {
        return {};
    }

    protected get logTag(): string {
        return "Auction-Syncrhoniser";
    }
    
}