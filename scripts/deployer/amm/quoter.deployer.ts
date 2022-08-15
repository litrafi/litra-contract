import { Quoter } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait } from "../../lib/utils";

type DeployeArgs = {
    factory: string,
    weth: string
}

export class QuoterDeployer extends ContractDeployer<Quoter, DeployeArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'Quoter', recorderKey: 'Quoter' }
    }

    protected async _deploy(args: DeployeArgs): Promise<string> {
        const quoter = await construcAndWait(this.contractName, [args.factory, args.weth]);
        return quoter.address;
    }
    
}