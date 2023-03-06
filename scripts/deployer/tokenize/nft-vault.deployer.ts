import { NFTVault } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";

declare type DeployArgs = {}

export class NFTVaultDeployer extends ContractDeployer<NFTVault, DeployArgs> {
    protected getContractName(): string {
        return 'NFTVault';
    }
}