import { OptionBookDeployer } from "../deployer/option/option-book.deployer";
import { Synchroniser } from "../lib/synchroniser";

export class OptionSynchroniser extends Synchroniser<{}> {
    protected getConfigFromFile(): {} {
        return {};
    }

    protected getConfigOnline(): Promise<{}> {
        return Promise.resolve({})
    }

    protected hasDeployed(): boolean {
        return new OptionBookDeployer().hasDeployed();
    }

    protected async deploy(fileConfig: {}): Promise<void> {
        await new OptionBookDeployer().getOrDeployInstance({});
    }

    protected getSynchroniseFuncs(): {} {
        return {};
    }

    protected get logTag(): string {
        return 'Option-Synchroniser';
    }
}