import { OrderBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

declare type DeployArgs = {
    config: string
}

export class OrderBookDeployer extends ContractDeployer<OrderBook, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'OrderBook', recorderKey: 'OrderBook' };
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const orderBook = await deployAndWait(this.contractName, [args.config]);
        return orderBook.address
    }

}