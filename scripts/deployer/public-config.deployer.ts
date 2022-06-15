import { PublicConfig } from "../../typechain";
import { ContractDeployer } from "../lib/deployer"
import { deployAndWait, executeAndWait } from "../lib/utils";

declare type DeployArgs = {
    weth: string,
    usdt: string,
    factory: string,
    pricingToken: string[]
}

export class PublicConfigDeployer extends ContractDeployer<PublicConfig, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined } {
        return { contractName: 'PublicConfig', recorderKey: 'PublicConfig' };
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const publicConfig = await deployAndWait<PublicConfig>(this.contractName, [args.weth, args.usdt, args.factory]);
        await executeAndWait(() => publicConfig.addPricingTokens(args.pricingToken));

        return publicConfig.address;
    }
    
}