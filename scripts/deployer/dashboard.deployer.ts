import { Dashboard } from "../../typechain/Dashboard";
import { ContractDeployer } from "../lib/deployer";
import { deployAndWait } from "../lib/utils";

declare type DeployArgs = {
    router: string,
    order: string,
    config: string
}

export class DashboardDeployer extends ContractDeployer<Dashboard, DeployArgs> {
    protected getDeployerConfig(): { contractName: string; recorderKey?: string | undefined; } {
        return { contractName: 'Dashboard', recorderKey: 'Dashboard' };
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const dashboard = await deployAndWait(this.contractName, [args.router, args.order, args.config]);
        return dashboard.address;
    }
}