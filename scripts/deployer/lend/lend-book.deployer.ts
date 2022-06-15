import { LendBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

declare type DeployArgs = {
    config: string
}

export class LendBookDeployer extends ContractDeployer<LendBook, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'LendBook', recorderKey: 'LendBook' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const lendBook = await deployAndWait(this.contractName, [args.config]);
        return lendBook.address;
    }
    
}