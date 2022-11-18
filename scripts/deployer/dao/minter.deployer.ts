import { Minter } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

type DeployArgs = {
    token: string,
    controller: string
}

export class MinterDeployer extends ContractDeployer<Minter, DeployArgs> {
    protected getContractName(): string {
        return 'Minter'
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.token, args.controller];
    }
}