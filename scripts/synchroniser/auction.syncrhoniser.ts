import { AuctionBookDeployer } from "../deployer/auction/auction-book.deployer";
import { PublicConfigDeployer } from "../deployer/public-config.deployer";
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
        const config = await new PublicConfigDeployer().getInstance();
        await new AuctionBookDeployer().getOrDeployInstance({ config: config.address });
    }
    
    protected getSynchroniseFuncs(): {} {
        return {};
    }

    protected get logTag(): string {
        return "Auction-Syncrhoniser";
    }
    
}