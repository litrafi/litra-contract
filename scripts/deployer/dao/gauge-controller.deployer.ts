import { GaugeController } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

type DeployArgs = {
    token: string,
    ve: string
}

export class GaugeControllerDeployer extends ContractDeployer<GaugeController, DeployArgs> {
    protected getContractName(): string {
        return 'GaugeController';
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.token, args.ve];
    }
    
}