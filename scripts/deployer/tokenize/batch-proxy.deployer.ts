import { BatchProxy } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

declare type DeployArgs = {
    vault: string
}

export class BatchProxyDeployer extends ContractDeployer<BatchProxy, DeployArgs> {
    protected getContractName(): string {
        return 'BatchProxy'
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.vault]
    }
}