import { OrderBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

export class OrderBookDeployer extends ContractDeployer<OrderBook, {}> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'OrderBook', recorderKey: 'OrderBook' };
    }

    protected async _deploy(args: {}): Promise<string> {
        const orderBook = await deployAndWait(this.contractName);
        return orderBook.address
    }

}