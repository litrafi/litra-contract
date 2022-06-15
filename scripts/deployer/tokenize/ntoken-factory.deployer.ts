import { NtokenFactory } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

export class NTokenFactoryDeployer extends ContractDeployer<NtokenFactory, {}> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'NtokenFactory', recorderKey: 'NtokenFactory' }
    }

    protected async _deploy(args: {}): Promise<string> {
        const factory = await deployAndWait(this.contractName);
        return factory.address;
    }

}