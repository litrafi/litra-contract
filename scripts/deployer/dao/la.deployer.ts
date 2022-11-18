import { LA } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";

type DeployArgs = {};

export class LADeployer extends ContractDeployer<LA, DeployArgs> {
    protected getContractName(): string {
        return 'LA'
    }
}