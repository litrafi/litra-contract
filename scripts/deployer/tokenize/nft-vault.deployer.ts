import { NftVault } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";

declare type DeployArgs = {}

export class NftVaultDeployer extends ContractDeployer<NftVault, DeployArgs> {
    protected getContractName(): string {
        return 'NftVault';
    }
}