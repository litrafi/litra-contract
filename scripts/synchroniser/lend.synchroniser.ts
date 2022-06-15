import { LendBookDeployer } from "../deployer/lend/lend-book.deployer";
import { PublicConfigDeployer } from "../deployer/public-config.deployer";
import { Synchroniser } from "../lib/synchroniser";

export class LendSynchroniser extends Synchroniser<{}> {
    protected getConfigFromFile(): {} {
        return {}
    }

    protected getConfigOnline(): Promise<{}> {
        return Promise.resolve({});
    }

    protected hasDeployed(): boolean {
        return new LendBookDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: {}): Promise<void> {
        const config = await new PublicConfigDeployer().getInstance();
        await new LendBookDeployer().getOrDeployInstance({ config: config.address });
    }

    protected getSynchroniseFuncs(): {} {
        return {};
    }

    protected get logTag(): string {
        return 'Lend-Syncrhoniser';
    }
    
}