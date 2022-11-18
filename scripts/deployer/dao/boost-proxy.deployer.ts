import { VEBoostProxy } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

type DeployArgs = {
    ve: string
}

export class BoostProxyDeployer extends ContractDeployer<VEBoostProxy, DeployArgs> {
    protected getContractName(): string {
        return 'VEBoostProxy';
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.ve];
    }
    
}