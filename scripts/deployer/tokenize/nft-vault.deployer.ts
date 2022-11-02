import { NftVault } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

declare type DeployArgs = {}

export class NftVaultDeployer extends ContractDeployer<NftVault, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'NftVault', recorderKey: 'NftVault' }
    }

    protected async _deploy(): Promise<string> {
        const vault = await construcAndWait<NftVault>(this.contractName)
        return vault.address;
    }

}