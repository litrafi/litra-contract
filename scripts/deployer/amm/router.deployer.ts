import { UniswapV2Router } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

declare type DeployerArgs = {
    factory: string,
    weth: string
}

export class UniswapRouterDeployer extends ContractDeployer<UniswapV2Router, DeployerArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'UniswapV2Router', recorderKey: 'UniswapV2Router'}
    }

    protected async _deploy(args: DeployerArgs): Promise<string> {
        const router = await construcAndWait(this.contractName, [args.factory, args.weth]);
        return router.address;
    }

}