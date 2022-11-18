import { FeeManager } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

type DeployArgs = {
    vault: string
}

export class FeeManagerDeployer extends ContractDeployer<FeeManager, DeployArgs> {
    protected getContractName(): string {
        return 'FeeManager';
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.vault];
    }
}