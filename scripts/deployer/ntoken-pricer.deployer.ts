import { NtokenPricer } from "../../typechain"
import { ContractDeployer } from "../lib/deployer"
import { deployAndWait } from "../lib/utils";

declare type DeployArgs = {
    weth: string,
    ammRouter: string,
    orderBook: string,
    config: string,
    dataFeeds: {
        tokenAddress: string,
        dataFeed: string
    }[]
}

export class NtokenPricerDeployer extends ContractDeployer<NtokenPricer, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined } {
        return { contractName: 'NtokenPricer', recorderKey: 'NtokenPricer' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const ntokenPricer = await deployAndWait<NtokenPricer>(this.contractName, [args.weth, args.ammRouter, args.orderBook, args.config]);
        const token = [];
        const feeds = [];
        for (const dataFeed of args.dataFeeds) {
            token.push(dataFeed.tokenAddress);
            feeds.push(dataFeed.dataFeed)
        }
        await ntokenPricer.setDataFeeds(token, feeds);
        return ntokenPricer.address;
    }
    
}