import { LendBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

export class LendBookDeployer extends ContractDeployer<LendBook, {}> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'LendBook', recorderKey: 'LendBook' }
    }

    protected async _deploy(args: {}): Promise<string> {
        const lendBook = await deployAndWait(this.contractName);
        return lendBook.address;
    }
    
}