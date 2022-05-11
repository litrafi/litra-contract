import { UniswapV2Router02 } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

declare type DeployerArgs = {
    factory: string,
    weth: string
}

export class UniswapRouterDeployer extends ContractDeployer<UniswapV2Router02, DeployerArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'UniswapV2Router02', recorderKey: 'UniswapRouter'}
    }

    protected async _deploy(args: DeployerArgs): Promise<string> {
        const router = await construcAndWait(this.contractName, [args.factory, args.weth]);
        return router.address;
    }

}