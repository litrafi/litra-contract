import { SwapRouter } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

type DeployArgs = {
    factory: string,
    weth: string
}

export class SwapRouterDeployer extends ContractDeployer<SwapRouter, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'SwapRouter', recorderKey: 'SwapRouter'}
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const router = await construcAndWait(this.contractName, [args.factory, args.weth]);
        return router.address;
    }
}