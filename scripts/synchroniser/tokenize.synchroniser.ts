import { NftVaultDeployer } from "../deployer/tokenize/nft-vault.deployer";
import { NTokenFactoryDeployer } from "../deployer/tokenize/ntoken-factory.deployer";
import { Synchroniser } from "../lib/synchroniser";

export class TokenizeSynchroniser extends Synchroniser<{}> {
    protected getConfigFromFile(): {} {
        return {};
    }

    protected getConfigOnline(): Promise<{}> {
        return Promise.resolve({});
    }

    protected hasDeployed(): boolean {
        return new NftVaultDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: {}): Promise<void> {
        const factory = await new NTokenFactoryDeployer().getOrDeployInstance({});
        await new NftVaultDeployer().getOrDeployInstance({ factory: factory.address });
    }

    protected getSynchroniseFuncs(): {} {
        return {}
    }

    protected get logTag(): string {
        return 'tokenize-synchroniser';
    }

}