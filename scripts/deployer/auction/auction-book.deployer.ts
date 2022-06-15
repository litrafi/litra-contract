import { AuctionBook } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { deployAndWait } from "../../lib/utils";

declare type DeployArgs = {
    config: string
}

export class AuctionBookDeployer extends ContractDeployer<AuctionBook, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'AuctionBook', recorderKey: 'AuctionBook' }
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const auctionBook = await deployAndWait(this.contractName, [args.config]);
        return auctionBook.address
    }
    
}