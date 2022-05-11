import { NftVault } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

declare type DeployArgs = {
    factory: string
}

export class NftVaultDeployer extends ContractDeployer<NftVault, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'NftVault', recorderKey: 'NftVault' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const vault = await deployAndWait<NftVault>(this.contractName, [ args.factory ])
        return vault.address;
    }

}