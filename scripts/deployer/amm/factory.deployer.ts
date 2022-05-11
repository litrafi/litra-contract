import { UniswapV2Factory } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait, getSelfAddress } from "../../lib/utils";

declare type DeployerArgs = {
    feeTo: string
}

export class UniswapFactoryDeployer extends ContractDeployer<UniswapV2Factory, DeployerArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'UniswapV2Factory', recorderKey: 'UniswapV2Factory' }
    }

    protected async _deploy(args: DeployerArgs): Promise<string> {
        const deployUser = await getSelfAddress();
        const factory = await construcAndWait<UniswapV2Factory>(this.contractName, [deployUser]);
        await factory.setFeeTo(args.feeTo);
        return factory.address;
    }

}