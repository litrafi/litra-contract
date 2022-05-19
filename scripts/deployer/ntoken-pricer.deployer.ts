import { NtokenPricer } from "../../typechain"
import { ContractDeployer } from "../lib/deployer"
import { deployAndWait } from "../lib/utils";

declare type DeployArgs = {
    weth: string,
    ammRouter: string,
    orderBook: string
}

export class NtokenPricerDeployer extends ContractDeployer<NtokenPricer, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined } {
        return { contractName: 'NtokenPricer', recorderKey: 'NtokenPricer' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const ntokenPricer = await deployAndWait(this.contractName, [args.weth, args.ammRouter, args.orderBook]);
        return ntokenPricer.address;
    }
    
}