import { OptionBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

export class OptionBookDeployer extends ContractDeployer<OptionBook, {}> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'OptionBook', recorderKey: 'OptionBook' }
    }

    protected async _deploy(args: {}): Promise<string> {
        const orderBook = await deployAndWait(this.contractName);
        return orderBook.address;
    }
}