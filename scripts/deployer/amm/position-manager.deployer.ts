import { NonfungiblePositionManager } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

type DeployArgs = {
    factory: string,
    weth: string
}

export class PositionManagerDeployer extends ContractDeployer<NonfungiblePositionManager, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'NonfungiblePositionManager', recorderKey: 'NonfungiblePositionManager' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const manager = await construcAndWait(this.contractName, [args.factory, args.weth]);
        return manager.address;
    }
    
}