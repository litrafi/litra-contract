import { FeeDistributor } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

type DeployArgs = {
    ve: string,
    starTime: number
}

export class FeeDistributorDeployer extends ContractDeployer<FeeDistributor, DeployArgs> {
    protected getContractName(): string {
        return 'FeeDistributor';
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.ve, args.starTime];
    }
}