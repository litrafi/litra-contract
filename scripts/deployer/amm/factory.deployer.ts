import { UniswapV3Factory } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

export class UniswapV3FactoryDeployer extends ContractDeployer<UniswapV3Factory, {}> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'UniswapV3Factory', recorderKey: 'UniswapV3Factory' }
    }

    protected async _deploy(args: {}): Promise<string> {
        const factory = await construcAndWait(this.contractName);
        return factory.address;
    }
    
}