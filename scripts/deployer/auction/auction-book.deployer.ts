import { AuctionBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

export class AuctionBookDeployer extends ContractDeployer<AuctionBook, {}> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'AuctionBook', recorderKey: 'AuctionBook' }
    }

    protected async _deploy(args: {}): Promise<string> {
        const auctionBook = await deployAndWait(this.contractName);
        return auctionBook.address
    }
    
}