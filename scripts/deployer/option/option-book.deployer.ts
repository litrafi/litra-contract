import { OptionBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

declare type DeployArgs = {
    config: string
}

export class OptionBookDeployer extends ContractDeployer<OptionBook, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'OptionBook', recorderKey: 'OptionBook' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const orderBook = await deployAndWait(this.contractName, [args.config]);
        return orderBook.address;
    }
}